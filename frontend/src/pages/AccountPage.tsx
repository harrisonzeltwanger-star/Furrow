import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageSkeleton } from '@/components/ui/skeleton';

interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: 'FARM_ADMIN' | 'MANAGER' | 'VIEWER';
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  type: string;
  token: string;
  link: string;
  expiresAt: string;
  createdAt: string;
}

const roleBadge: Record<string, string> = {
  FARM_ADMIN: 'Admin',
  MANAGER: 'Manager',
  VIEWER: 'Viewer',
};

const orgTypeBadge: Record<string, string> = {
  BUYER: 'Buyer',
  GROWER: 'Grower',
  TRUCKING: 'Trucking',
};

export default function AccountPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'FARM_ADMIN';

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteType, setInviteType] = useState<'team' | 'admin'>('team');
  const [inviteEmail, setInviteEmail] = useState('');
  const [teamRole, setTeamRole] = useState<'MANAGER' | 'VIEWER'>('MANAGER');
  const [inviteResult, setInviteResult] = useState<{ link: string } | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState('');

  async function fetchData() {
    try {
      const [teamRes, invitesRes] = await Promise.all([
        api.get('/users/team'),
        isAdmin ? api.get('/users/invites') : Promise.resolve({ data: { invites: [] } }),
      ]);
      setTeam(teamRes.data.users);
      setInvites(invitesRes.data.invites);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError('');
    setInviteResult(null);
    setSubmitting(true);

    const role = inviteType === 'admin' ? 'FARM_ADMIN' : teamRole;

    try {
      const res = await api.post('/users/invite', { email: inviteEmail, role, type: inviteType });
      setInviteResult({ link: res.data.invite.link });
      setInviteEmail('');
      fetchData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setInviteError(axiosErr.response?.data?.error?.message || 'Failed to create invite');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelInvite(id: string) {
    try {
      await api.delete(`/users/invites/${id}`);
      fetchData();
    } catch {
      // ignore
    }
  }

  async function handleToggleActive(userId: string, currentlyActive: boolean) {
    try {
      const action = currentlyActive ? 'deactivate' : 'activate';
      await api.patch(`/users/${userId}/${action}`);
      fetchData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      alert(axiosErr.response?.data?.error?.message || 'Action failed');
    }
  }

  async function handleDeleteUser(userId: string, name: string) {
    if (!confirm(`Are you sure you want to permanently delete ${name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${userId}`);
      fetchData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      alert(axiosErr.response?.data?.error?.message || 'Delete failed');
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

      {/* --- Profile Section --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">My Account</CardTitle>
          <CardDescription>Your profile and organization details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Name</p>
              <p className="font-medium">{user?.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
              <p className="font-medium">{user?.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Role</p>
              <Badge variant="default">{roleBadge[user?.role ?? ''] ?? user?.role}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Organization</p>
              <p className="font-medium">
                {user?.organizationName}
                {user?.organizationType && (
                  <Badge variant="secondary" className="ml-2">
                    {orgTypeBadge[user.organizationType] ?? user.organizationType}
                  </Badge>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --- Team Members --- */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Organization Users</h2>
          {isAdmin && (
            <Button size="sm" onClick={() => { setShowInvite(!showInvite); setInviteResult(null); setInviteError(''); }}>
              {showInvite ? 'Cancel' : 'Invite User'}
            </Button>
          )}
        </div>

        {/* Invite form */}
        {showInvite && isAdmin && (
          <Card className="mb-4">
            <CardContent className="pt-6">
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label>Invite Type</Label>
                    <select
                      value={inviteType}
                      onChange={(e) => setInviteType(e.target.value as 'team' | 'admin')}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="team">Team Member (joins {user?.organizationName})</option>
                      <option value="admin">New Company Admin (creates own org)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>
                  {inviteType === 'team' && (
                    <div className="space-y-1">
                      <Label>Role</Label>
                      <select
                        value={teamRole}
                        onChange={(e) => setTeamRole(e.target.value as 'MANAGER' | 'VIEWER')}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="MANAGER">Manager</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                    </div>
                  )}
                </div>
                <Button type="submit" disabled={!inviteEmail || submitting}>
                  {submitting ? 'Creating...' : 'Create Invite Link'}
                </Button>
              </form>

              {inviteResult && (
                <div className="mt-4 rounded-md border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-4">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                    Invite link created! Share this with the invitee:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-background rounded px-3 py-2 border overflow-x-auto">
                      {inviteResult.link}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(inviteResult.link, 'result')}
                    >
                      {copied === 'result' ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                </div>
              )}

              {inviteError && (
                <div className="mt-4 rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">
                  {inviteError}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Team table */}
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="text-left px-4 py-2 font-medium">Role</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Last Login</th>
                {isAdmin && <th className="text-right px-4 py-2 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {team.map((member) => {
                const isSelf = member.id === user?.id;
                const isFarmAdmin = member.role === 'FARM_ADMIN';
                const canManage = isAdmin && !isSelf && !isFarmAdmin;

                return (
                  <tr key={member.id} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">
                      {member.name}
                      {isSelf && <span className="text-muted-foreground ml-1">(you)</span>}
                    </td>
                    <td className="px-4 py-2">{member.email}</td>
                    <td className="px-4 py-2">
                      <Badge variant={member.role === 'FARM_ADMIN' ? 'default' : 'secondary'}>
                        {roleBadge[member.role] ?? member.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={member.isActive ? 'default' : 'destructive'}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {member.lastLogin
                        ? new Date(member.lastLogin).toLocaleDateString()
                        : 'Never'}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-2 text-right space-x-2">
                        {canManage && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleActive(member.id, member.isActive)}
                            >
                              {member.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteUser(member.id, member.name)}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Pending Invites --- */}
      {isAdmin && invites.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Pending Invites</h2>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium">Email</th>
                  <th className="text-left px-4 py-2 font-medium">Type</th>
                  <th className="text-left px-4 py-2 font-medium">Role</th>
                  <th className="text-left px-4 py-2 font-medium">Expires</th>
                  <th className="text-right px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{inv.email}</td>
                    <td className="px-4 py-2">
                      <Badge variant={inv.type === 'admin' ? 'default' : 'secondary'}>
                        {inv.type === 'admin' ? 'Admin' : 'Team'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">{roleBadge[inv.role] ?? inv.role}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(inv.link, inv.id)}
                      >
                        {copied === inv.id ? 'Copied!' : 'Copy Link'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelInvite(inv.id)}
                      >
                        Cancel
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
