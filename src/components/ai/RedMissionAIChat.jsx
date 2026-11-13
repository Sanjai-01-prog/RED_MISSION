import React, { useEffect, useRef, useState } from 'react';
import { aiApi } from '../../services/api';
import FloatingAIButton from './FloatingAIButton';
import AIChatWindow from './AIChatWindow';

const STORAGE_PREFIX = 'red_mission_ai_chat_v1_';

function createMsgId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function RedMissionAIChat({ currentUser }) {
  // Scope conversation history strictly to current authenticated user (or anonymous visitor)
  const sessionScope = currentUser?.id ? `user_${currentUser.id}` : 'guest';
  const storageKey = `${STORAGE_PREFIX}${sessionScope}`;

  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [aiStatus, setAiStatus] = useState({
    checked: false,
    configured: null,
    provider: '',
  });

  const activeAbortRef = useRef(null);

  // Load isolated session conversation when sessionScope changes
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed.slice(-20));
          return;
        }
      }
    } catch {
      // Ignore corrupt sessionStorage entries
    }
    setMessages([]);
  }, [storageKey]);

  // Persist session conversation
  useEffect(() => {
    try {
      if (messages.length === 0) {
        sessionStorage.removeItem(storageKey);
      } else {
        sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-20)));
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [messages, storageKey]);

  // Abort in-flight AI streams on unmount or user session change
  useEffect(() => {
    return () => {
      activeAbortRef.current?.abort();
    };
  }, [sessionScope]);

  // Check backend AI provider status on open
  useEffect(() => {
    if (!isOpen || aiStatus.checked) return;
    const controller = new AbortController();
    aiApi
      .getStatus({ signal: controller.signal })
      .then((res) => {
        if (res && typeof res.configured === 'boolean') {
          setAiStatus({
            checked: true,
            configured: res.configured,
            provider: res.provider && res.provider !== 'NONE' ? res.provider : '',
          });
        }
      })
      .catch(() => {
        setAiStatus((prev) => ({ ...prev, checked: true }));
      });
    return () => controller.abort();
  }, [isOpen, aiStatus.checked]);

  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) setHasUnread(false);
      return next;
    });
  };

  const handleMinimize = () => {
    setIsOpen(false);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleResetConversation = () => {
    activeAbortRef.current?.abort();
    setIsStreaming(false);
    setIsTyping(false);
    setMessages([]);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // Ignore
    }
  };

  const handleSendMessage = async (text) => {
    const cleanText = String(text || '').trim();
    if (!cleanText || isStreaming) return;

    const userMsg = {
      id: createMsgId(),
      role: 'user',
      content: cleanText,
    };

    const conversationBeforeSend = messages.filter(
      (m) => (m.role === 'user' || m.role === 'assistant') && m.content.trim()
    );
    const payloadMessages = [...conversationBeforeSend, { role: 'user', content: cleanText }].slice(-20);

    const assistantMsgId = createMsgId();
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setIsTyping(true);

    const controller = new AbortController();
    activeAbortRef.current = controller;
    let assistantInserted = false;

    try {
      const finalMeta = await aiApi.streamChat({
        messages: payloadMessages,
        signal: controller.signal,
        onChunk: (delta) => {
          setIsTyping(false);
          if (!assistantInserted) {
            assistantInserted = true;
            setMessages((prev) => [
              ...prev,
              { id: assistantMsgId, role: 'assistant', content: delta },
            ]);
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: m.content + delta } : m
              )
            );
          }
        },
      });

      if (!assistantInserted && finalMeta?.reply) {
        assistantInserted = true;
        setMessages((prev) => [
          ...prev,
          { id: assistantMsgId, role: 'assistant', content: finalMeta.reply },
        ]);
      }

      if (finalMeta?.provider) {
        setAiStatus({
          checked: true,
          configured: true,
          provider: finalMeta.provider,
        });
      }

      if (!isOpen) {
        setHasUnread(true);
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setIsTyping(false);

      if (err?.code === 'AI_NOT_CONFIGURED') {
        setAiStatus({ checked: true, configured: false, provider: '' });
      }

      setMessages((prev) => [
        ...prev,
        {
          id: createMsgId(),
          role: 'error',
          content:
            err?.message ||
            'Sorry, RED MISSION AI could not complete that request right now. Please try again.',
        },
      ]);
    } finally {
      setIsTyping(false);
      setIsStreaming(false);
      activeAbortRef.current = null;
    }
  };

  return (
    <>
      <AIChatWindow
        isOpen={isOpen}
        aiConfigured={aiStatus.configured}
        providerLabel={aiStatus.provider}
        messages={messages}
        isTyping={isTyping}
        isStreaming={isStreaming}
        onSendMessage={handleSendMessage}
        onNewChat={handleResetConversation}
        onClearChat={handleResetConversation}
        onMinimize={handleMinimize}
        onClose={handleClose}
      />

      <FloatingAIButton
        isOpen={isOpen}
        onToggle={handleToggle}
        hasUnread={hasUnread}
      />
    </>
  );
}
