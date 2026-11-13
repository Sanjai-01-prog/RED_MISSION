import React, { useState, useEffect, useCallback, useId } from 'react';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
  Image as ImageIcon,
  ShieldCheck
} from 'lucide-react';
import { rotaractApi } from '../../services/api';

function AdminMemberPhotoPreview({ member }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!member?.hasPhoto) {
      setBlobUrl(null);
      setFailed(false);
      return;
    }
    let active = true;
    let objectUrl = null;
    const controller = new AbortController();

    async function load() {
      setFailed(false);
      try {
        objectUrl = await rotaractApi.fetchAdminPhotoBlobUrl(member.id, { signal: controller.signal });
        if (active) {
          setBlobUrl(objectUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
        }
      } catch (err) {
        if (active && err.name !== 'AbortError') {
          setFailed(true);
        }
      }
    }

    load();
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [member?.id, member?.hasPhoto, member?.updatedAt]);

  const initials = String(member?.fullName || 'RM')
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (member?.hasPhoto && blobUrl && !failed) {
    return (
      <img
        src={blobUrl}
        alt={member.fullName}
        className="w-12 h-12 rounded-xl object-cover border border-white/15 shrink-0"
      />
    );
  }

  return (
    <div
      className="w-12 h-12 rounded-xl bg-space-850 border border-white/10 flex items-center justify-center font-orbitron font-bold text-xs text-mars-300 shrink-0"
      aria-hidden="true"
    >
      {initials || 'RM'}
    </div>
  );
}

const DESIGNATION_SUGGESTIONS = [
  'President',
  'Secretary',
  'Treasurer',
  'Vice President',
  'Joint Secretary',
  'Sergeant-at-Arms',
  'Director - Community Service',
  'Blood Donation Coordinator',
  'Club Advisor'
];

export default function RotaractDirectoryAdminTab({ currentAdmin, onOpenPublicDirectory }) {
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState({ total: 0, publishedCount: 0, hiddenCount: 0, withPhotoCount: 0 });
  const [storageMode, setStorageMode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add / Edit Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [fullName, setFullName] = useState('');
  const [designation, setDesignation] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [photoPayload, setPhotoPayload] = useState('');
  const [removePhoto, setRemovePhoto] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const nameId = useId();
  const desigId = useId();
  const desigListId = useId();
  const photoInputId = useId();
  const publicCheckboxId = useId();

  const adminRole = currentAdmin?.roleId || currentAdmin?.role_id;
  const canManage = ['SUPER_ADMIN', 'ADMIN'].includes(adminRole);

  const fetchAdminMembers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await rotaractApi.getAdminMembers();
      if (res.success) {
        setMembers(Array.isArray(res.members) ? res.members : []);
        setStats(res.stats || { total: 0, publishedCount: 0, hiddenCount: 0, withPhotoCount: 0 });
        setStorageMode(res.storageMode || '');
      } else {
        setError(res.error || 'Failed to fetch Rotaract directory records.');
      }
    } catch (err) {
      setError('Unable to reach Rotaract directory service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) {
      fetchAdminMembers();
    } else {
      setLoading(false);
    }
  }, [canManage, fetchAdminMembers]);

  const openAddModal = () => {
    setEditingMember(null);
    setFullName('');
    setDesignation('');
    setIsPublic(true);
    setPhotoPayload('');
    setRemovePhoto(false);
    setFormError('');
    setError('');
    setSuccessMsg('');
    setIsFormOpen(true);
  };

  const openEditModal = (member) => {
    setEditingMember(member);
    setFullName(member.fullName || '');
    setDesignation(member.designation || '');
    setIsPublic(Boolean(member.isPublic));
    setPhotoPayload('');
    setRemovePhoto(false);
    setFormError('');
    setError('');
    setSuccessMsg('');
    setIsFormOpen(true);
  };

  const handlePhotoFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const mime = String(file.type || '').toLowerCase();
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp'];
    const hasAllowedExt = /\.(jpe?g|png|webp)$/i.test(file.name || '');
    const mimeAccepted = allowedMimes.includes(mime) || ((mime === '' || mime === 'application/octet-stream') && hasAllowedExt);

    if (!mimeAccepted) {
      setFormError('Unsupported image format. Please choose a JPEG, PNG, or WebP photograph.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setFormError('Member photograph exceeds the 3 MiB upload size limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoPayload(reader.result);
        setRemovePhoto(false);
        setFormError('');
      } else {
        setFormError('Failed to encode selected image file.');
      }
    };
    reader.onerror = () => {
      setFormError('Failed to read selected image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return;

    const cleanName = fullName.trim();
    const cleanDesig = designation.trim();
    if (cleanName.length < 2) {
      setFormError('Full name must be at least 2 characters long.');
      return;
    }
    if (cleanDesig.length < 2) {
      setFormError('Official designation must be at least 2 characters long.');
      return;
    }

    setSaving(true);
    setFormError('');
    setError('');
    setSuccessMsg('');

    try {
      const payload = {
        fullName: cleanName,
        designation: cleanDesig,
        isPublic
      };
      if (photoPayload) {
        payload.photoPayload = photoPayload;
      } else if (editingMember && removePhoto) {
        payload.removePhoto = true;
      }

      const res = editingMember
        ? await rotaractApi.updateMember(editingMember.id, payload)
        : await rotaractApi.createMember(payload);

      if (res.success && res.member) {
        setIsFormOpen(false);
        setFormError('');
        setSuccessMsg(res.message || (editingMember ? 'Member updated.' : 'Member added.'));
        await fetchAdminMembers();
      } else {
        setFormError(res.error || 'Could not save directory member.');
      }
    } catch (err) {
      setFormError('Network error while saving directory entry. Please verify the backend server is running.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async (member) => {
    setError('');
    setSuccessMsg('');
    try {
      const res = await rotaractApi.updateMember(member.id, { isPublic: !member.isPublic });
      if (res.success) {
        setSuccessMsg(`${member.fullName} is now ${!member.isPublic ? 'visible in public directory' : 'hidden from public directory'}.`);
        await fetchAdminMembers();
      } else {
        setError(res.error || 'Failed to update public visibility.');
      }
    } catch (err) {
      setError('Network error while updating public visibility.');
    }
  };

  const handleMove = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= members.length || reordering) return;

    const reordered = [...members];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    setReordering(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await rotaractApi.reorderMembers(reordered.map((m) => m.id));
      if (res.success) {
        setMembers(res.members || reordered);
        setSuccessMsg(`Moved "${moved.fullName}" to position #${targetIndex + 1}.`);
      } else {
        setError(res.error || 'Failed to update member display order.');
      }
    } catch (err) {
      setError('Network error while reordering directory members.');
    } finally {
      setReordering(false);
    }
  };

  const handleDelete = async (id) => {
    setError('');
    setSuccessMsg('');
    try {
      const res = await rotaractApi.deleteMember(id);
      if (res.success) {
        setConfirmDeleteId(null);
        setSuccessMsg('Member removed from Rotaract directory.');
        await fetchAdminMembers();
      } else {
        setError(res.error || 'Failed to remove directory member.');
      }
    } catch (err) {
      setError('Network error while removing directory member.');
    }
  };

  if (!canManage) {
    return (
      <div className="rounded-3xl bg-rose-500/10 border border-rose-500/30 p-8 text-center space-y-3">
        <ShieldCheck className="w-8 h-8 text-rose-400 mx-auto" />
        <h3 className="font-orbitron font-bold text-lg text-white">Administrator Authorization Required</h3>
        <p className="text-xs font-mono text-slate-300 max-w-md mx-auto">
          Only ADMIN and SUPER_ADMIN roles are permitted to manage the Rotaract College Members Directory.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="rounded-2xl bg-space-900/75 border border-white/10 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-mars-400" aria-hidden="true" />
            <h2 className="font-orbitron font-bold text-base sm:text-lg text-white">
              Rotaract KPRIET Members Directory Manager
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Maintain public member cards (photo, full name, official designation, and display order). Only entries marked Published appear publicly.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onOpenPublicDirectory && (
            <button
              type="button"
              onClick={onOpenPublicDirectory}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-space-850 hover:bg-space-800 border border-white/15 text-xs font-mono text-slate-200 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
              <span>View Public Page</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchAdminMembers}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-space-850 hover:bg-space-800 border border-white/15 text-xs font-mono text-slate-300 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-mars-600 hover:bg-mars-500 text-xs font-mono font-semibold text-white transition-colors cursor-pointer shadow-lg shadow-mars-600/20"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl bg-space-900/70 border border-white/10 p-4">
          <div className="text-[11px] font-mono uppercase text-slate-400">Total Profiles</div>
          <div className="text-2xl font-orbitron font-extrabold text-white mt-1">{stats.total}</div>
        </div>
        <div className="rounded-2xl bg-space-900/70 border border-emerald-500/20 p-4">
          <div className="text-[11px] font-mono uppercase text-emerald-300">Published Public</div>
          <div className="text-2xl font-orbitron font-extrabold text-emerald-400 mt-1">{stats.publishedCount}</div>
        </div>
        <div className="rounded-2xl bg-space-900/70 border border-amber-500/20 p-4">
          <div className="text-[11px] font-mono uppercase text-amber-300">Hidden Drafts</div>
          <div className="text-2xl font-orbitron font-extrabold text-amber-400 mt-1">{stats.hiddenCount}</div>
        </div>
        <div className="rounded-2xl bg-space-900/70 border border-white/10 p-4">
          <div className="text-[11px] font-mono uppercase text-slate-400">Storage Engine</div>
          <div className="text-xs font-mono font-bold text-cyan-300 mt-2 uppercase">{storageMode || 'active'}</div>
        </div>
      </div>

      {/* Feedback Alerts */}
      {error && (
        <div role="alert" className="rounded-xl bg-rose-500/10 border border-rose-500/35 px-4 py-3 flex items-center gap-2.5 text-xs text-rose-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div role="status" aria-live="polite" className="rounded-xl bg-emerald-500/10 border border-emerald-500/35 px-4 py-3 flex items-center gap-2.5 text-xs text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Members Table / List */}
      <div className="rounded-2xl bg-space-900/75 border border-white/10 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-xs font-mono text-slate-400">Loading member roster...</div>
        ) : members.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <Users className="w-8 h-8 text-slate-500 mx-auto" aria-hidden="true" />
            <p className="text-sm text-slate-300">No Rotaract members added yet.</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Use &ldquo;Add Member&rdquo; to publish verified office bearers with their photograph, full name, and designation.
            </p>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-white/10">
            {members.map((member, index) => (
              <li key={member.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="w-7 text-center text-xs font-mono font-bold text-slate-400 shrink-0">
                    #{index + 1}
                  </span>

                  <AdminMemberPhotoPreview member={member} />

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-orbitron font-bold text-sm text-white truncate">
                        {member.fullName}
                      </h3>
                      {member.isPublic ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-[10px] font-mono text-emerald-300">
                          <Eye className="w-3 h-3" aria-hidden="true" />
                          <span>Published</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-[10px] font-mono text-amber-300">
                          <EyeOff className="w-3 h-3" aria-hidden="true" />
                          <span>Hidden</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-mono text-mars-300 truncate">{member.designation}</p>
                  </div>
                </div>

                {/* Row Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMove(index, -1)}
                    disabled={index === 0 || reordering}
                    aria-label={`Move ${member.fullName} up`}
                    className="p-2 rounded-lg bg-space-850 hover:bg-space-800 border border-white/10 text-slate-300 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMove(index, 1)}
                    disabled={index === members.length - 1 || reordering}
                    aria-label={`Move ${member.fullName} down`}
                    className="p-2 rounded-lg bg-space-850 hover:bg-space-800 border border-white/10 text-slate-300 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleVisibility(member)}
                    className="px-2.5 py-1.5 rounded-lg bg-space-850 hover:bg-space-800 border border-white/10 text-xs font-mono text-slate-200 cursor-pointer"
                  >
                    {member.isPublic ? 'Hide' : 'Publish'}
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(member)}
                    aria-label={`Edit ${member.fullName}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-xs font-mono text-cyan-200 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Edit</span>
                  </button>

                  {confirmDeleteId === member.id ? (
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDelete(member.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-mono text-white cursor-pointer"
                      >
                        Confirm Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1.5 rounded-lg bg-space-850 border border-white/10 text-xs font-mono text-slate-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(member.id)}
                      aria-label={`Remove ${member.fullName}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-mono text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add / Edit Member Modal */}
      {isFormOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rotaract-member-form-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-space-900 border border-white/15 shadow-2xl">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-space-900 z-10">
              <h3 id="rotaract-member-form-title" className="font-orbitron font-bold text-base text-white">
                {editingMember ? 'Edit Rotaract Member' : 'Add Rotaract Directory Member'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setFormError('');
                  setIsFormOpen(false);
                }}
                aria-label="Close member form"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div role="alert" className="rounded-xl bg-rose-500/15 border border-rose-500/40 px-4 py-3 flex items-start gap-2.5 text-xs text-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{formError}</span>
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor={nameId} className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                  Full Name *
                </label>
                <input
                  id={nameId}
                  type="text"
                  required
                  maxLength={120}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter official member full name"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-space-950 border border-white/15 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-mars-500"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor={desigId} className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                  Official Designation *
                </label>
                <input
                  id={desigId}
                  type="text"
                  required
                  maxLength={120}
                  list={desigListId}
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. President, Secretary, Blood Donation Chair"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-space-950 border border-white/15 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-mars-500"
                />
                <datalist id={desigListId}>
                  {DESIGNATION_SUGGESTIONS.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-2">
                <label htmlFor={photoInputId} className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                  Member Photograph (JPEG / PNG / WebP, max 3 MiB)
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <label
                    htmlFor={photoInputId}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-space-850 hover:bg-space-800 border border-white/15 text-xs font-mono text-slate-200 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-mars-400" aria-hidden="true" />
                    <span>{photoPayload ? 'Choose Different Photo' : (editingMember?.hasPhoto ? 'Change Photo' : 'Upload Photograph')}</span>
                  </label>

                  <input
                    id={photoInputId}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoFileChange}
                    className="sr-only"
                  />

                  {editingMember?.hasPhoto && !removePhoto && !photoPayload && (
                    <button
                      type="button"
                      onClick={() => setRemovePhoto(true)}
                      className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-mono text-rose-300 cursor-pointer"
                    >
                      Remove Existing Photo
                    </button>
                  )}
                </div>

                {photoPayload && (
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-space-950 border border-emerald-500/30">
                    <img src={photoPayload} alt="Selected preview" className="w-14 h-14 rounded-lg object-cover border border-white/15" />
                    <div className="text-xs font-mono text-emerald-300 flex-1">New photograph ready to upload</div>
                    <button
                      type="button"
                      onClick={() => setPhotoPayload('')}
                      className="text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {removePhoto && (
                  <div className="text-xs font-mono text-amber-300 flex items-center gap-2">
                    <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Existing photograph will be removed on save.</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-1">
                <input
                  id={publicCheckboxId}
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-4 h-4 accent-mars-500 rounded cursor-pointer"
                />
                <label htmlFor={publicCheckboxId} className="text-xs font-mono text-slate-200 cursor-pointer">
                  Authorize for public display in Rotaract College Members Directory
                </label>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFormError('');
                    setIsFormOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 text-xs font-mono text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-mars-600 hover:bg-mars-500 text-xs font-mono font-semibold text-white transition-colors cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'Saving...' : (editingMember ? 'Save Changes' : 'Add Member')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
