'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth-provider';
import { apiRequest } from '../../api-client';
import { useDashboard } from '../dashboard-context';

type Member = {
  user: { id: string; firstName: string; lastName: string; email: string; createdAt: string; organizationMemberships: Array<{ role: string }> };
  role: string;
  status: 'ACTIVE' | 'SUSPENDED';
  suspendedAt: string | null;
  createdAt: string;
};
type Invitation = { id: string; email: string; role: string; expiresAt: string; createdAt: string; acceptedAt: string | null; revokedAt: string | null; localInvitationUrl?: string; invitedBy: { firstName: string; lastName: string; email: string } };

function date(value: string): string { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)); }

export function TeamManagement() {
  const { user } = useAuth();
  const { currentWorkspace, organizationRole, workspaceRole } = useDashboard();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('AGENT');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const canManage = organizationRole === 'OWNER' || organizationRole === 'ADMIN' || workspaceRole === 'ADMIN';
  const canAssignAdmin = organizationRole === 'OWNER' || organizationRole === 'ADMIN';

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true); setError('');
    try {
      const [nextMembers, nextInvitations] = await Promise.all([
        apiRequest<Member[]>(`/workspaces/${currentWorkspace.id}/members`),
        apiRequest<Invitation[]>(`/workspaces/${currentWorkspace.id}/invitations`),
      ]);
      setMembers(nextMembers); setInvitations(nextInvitations);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load team access.'); }
    finally { setLoading(false); }
  }, [currentWorkspace]);
  useEffect(() => { void load(); }, [load]);

  const visibleMembers = useMemo(() => members.filter((member) => {
    const haystack = `${member.user.firstName} ${member.user.lastName} ${member.user.email}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase()) && (roleFilter === 'ALL' || member.role === roleFilter) && (statusFilter === 'ALL' || member.status === statusFilter);
  }), [members, roleFilter, search, statusFilter]);
  const pendingInvitations = useMemo(() => invitations.filter((item) => !item.acceptedAt && !item.revokedAt && item.email.toLowerCase().includes(search.trim().toLowerCase()) && (roleFilter === 'ALL' || item.role === roleFilter)), [invitations, roleFilter, search]);

  async function invite(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setSubmitting(true); setError(''); setSuccess('');
    try {
      const invitation = await apiRequest<Invitation>(`/workspaces/${currentWorkspace?.id}/invitations`, { method: 'POST', body: JSON.stringify({ email, role }) });
      setEmail(''); setSuccess(invitation.localInvitationUrl ? 'Invitation created. A local development link is available below.' : 'Invitation created and queued for delivery.'); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to create invitation.'); }
    finally { setSubmitting(false); }
  }
  async function updateMember(memberId: string, nextRole: string): Promise<void> {
    setError('');
    try { await apiRequest(`/workspaces/${currentWorkspace?.id}/members/${memberId}`, { method: 'PATCH', body: JSON.stringify({ role: nextRole }) }); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to update member.'); }
  }
  async function setMemberStatus(memberId: string, status: 'suspend' | 'reactivate'): Promise<void> {
    if (status === 'suspend' && !window.confirm('Suspend this member? They will lose workspace access until reactivated.')) return;
    setError(''); setSuccess('');
    try { await apiRequest(`/workspaces/${currentWorkspace?.id}/members/${memberId}/${status}`, { method: 'POST' }); setSuccess(status === 'suspend' ? 'Member suspended.' : 'Member reactivated.'); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to update member status.'); }
  }
  async function removeMember(memberId: string): Promise<void> {
    if (!window.confirm('Remove this member from the workspace?')) return;
    setError('');
    try { await apiRequest(`/workspaces/${currentWorkspace?.id}/members/${memberId}`, { method: 'DELETE' }); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to remove member.'); }
  }
  async function invitationAction(invitationId: string, action: 'resend' | 'revoke'): Promise<void> {
    setError('');
    try { await apiRequest(`/workspace-invitations/${invitationId}${action === 'resend' ? '/resend' : ''}`, { method: action === 'resend' ? 'POST' : 'DELETE' }); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to update invitation.'); }
  }

  return <section className="team-management">
    <div className="team-management-intro"><div><p className="eyebrow">Workspace access</p><h2>People with access</h2><p>Manage access to {currentWorkspace?.name ?? 'this workspace'} without changing organization membership.</p></div>{canManage && <button className="button button-small" type="button" onClick={() => document.getElementById('invite-member')?.focus()}>Invite member <span>↗</span></button>}</div>
    {error && <p className="dashboard-error" role="alert">{error}</p>}{success && <p className="team-success" role="status">{success}</p>}
    {canManage && <form className="invite-form" onSubmit={invite}><div><label htmlFor="invite-member">Invite by email</label><input id="invite-member" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@company.com" /></div><div><label htmlFor="invite-role">Workspace role</label><select id="invite-role" value={role} onChange={(event) => setRole(event.target.value)}><option value="AGENT">Agent · works conversations</option><option value="VIEWER">Viewer · read-only access</option>{canAssignAdmin && <option value="ADMIN">Admin · manages workspace access</option>}</select></div><button className="button button-small" type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Send invitation'}</button></form>}
    <div className="team-filters" role="search"><div><label htmlFor="member-search">Search members</label><input id="member-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or email" /></div><div><label htmlFor="member-role-filter">Role</label><select id="member-role-filter" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="ALL">All roles</option><option value="ADMIN">Admin</option><option value="AGENT">Agent</option><option value="VIEWER">Viewer</option></select></div><div><label htmlFor="member-status-filter">Status</label><select id="member-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select></div></div>
    {loading ? <p className="dashboard-inline-status">Loading members…</p> : <div className="member-list">{visibleMembers.map((member) => <article className="member-row" key={member.user.id}><span className="user-avatar">{member.user.firstName[0]}{member.user.lastName[0]}</span><div className="member-identity"><strong>{member.user.firstName} {member.user.lastName} {member.user.id === user?.id && <small>(you)</small>}</strong><span>{member.user.email}</span></div><span className="member-joined">Joined {date(member.createdAt)}</span>{member.status === 'SUSPENDED' && <span className="role-pill status-suspended">Suspended</span>}{canManage && member.user.id !== user?.id ? <><select aria-label={`Role for ${member.user.email}`} value={member.role} onChange={(event) => void updateMember(member.user.id, event.target.value)}><option value="AGENT">Agent</option><option value="VIEWER">Viewer</option>{canAssignAdmin && <option value="ADMIN">Admin</option>}</select>{member.status === 'SUSPENDED' ? <button className="text-action" type="button" onClick={() => void setMemberStatus(member.user.id, 'reactivate')}>Reactivate</button> : <button className="text-action" type="button" onClick={() => void setMemberStatus(member.user.id, 'suspend')}>Suspend</button>}<button className="danger-button" type="button" onClick={() => void removeMember(member.user.id)}>Remove</button></> : <span className="role-pill">{member.role}</span>}</article>)}{visibleMembers.length === 0 && <p className="team-empty">No members match the current filters.</p>}</div>}
    {canManage && <div className="pending-invitations"><div className="section-heading"><div><p className="eyebrow">Pending invitations</p><h3>Awaiting acceptance</h3></div><span className="section-hint">Invitations expire after 72 hours.</span></div>{pendingInvitations.map((invitation) => <article className="member-row invitation-row" key={invitation.id}><div className="member-identity"><strong>{invitation.email}</strong><span>{invitation.role} · invited by {invitation.invitedBy.firstName} {invitation.invitedBy.lastName}</span></div><span className="member-joined">Expires {date(invitation.expiresAt)}</span>{invitation.localInvitationUrl && <a className="copy-link" href={invitation.localInvitationUrl}>Open local link</a>}<button className="text-action" type="button" onClick={() => void invitationAction(invitation.id, 'resend')}>Resend</button><button className="danger-button" type="button" onClick={() => void invitationAction(invitation.id, 'revoke')}>Revoke</button></article>)}{pendingInvitations.length === 0 && <p className="team-empty">No pending invitations match the current filters.</p>}</div>}
  </section>;
}
