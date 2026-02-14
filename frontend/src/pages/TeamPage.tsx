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
  expiresAt: string;
  createdAt: string;
}

export default function TeamPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'FARM_ADMIN';

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form state
  const [adminEmail, setAdminEmail] = useState('');
  const [teamEmail, setTeamEmail] = useState('');
  const [teamRole, setTeamRole] = useState<'MANAGER' | 'VIEWER'>('MANAGER');
  const [inviteResult, setInviteResult] = useState<{ email: string } | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  async function handleInvite(type: 'admin' | 'team') {
    setInviteError('');
    setInviteResult(null);
    setSubmitting(true);

    const email = type === 'admin' ? adminEmail : teamEmail;
    const role = type === 'admin' ? 'FARM_ADMIN' : teamRole;

    try {
      await api.post('/users/invite', { email, role, type });
      setInviteResult({ email });
      if (type === 'admin') setAdminEmail('');
      else setTeamEmail('');
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

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Team Management</h1>
        <p className="text-muted-foreground mt-1">Manage your organization's users and invitations</p>
      </div>

      {/* Invite Cards - FARM_ADMIN only */}
      {isAdmin && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Invite Admin Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Invite Admin</CardTitle>
              <CardDescription>Invite a new company admin to the platform. They'll create their own organization during signup.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="admin-email">Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@company.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => handleInvite('admin')}
                  disabled={!adminEmail || submitting}
                  className="w-full"
                >
                  {submitting ? 'Sending...' : 'Send Invite'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Invite Team Member Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Invite Team Member</CardTitle>
              <CardDescription>Invite someone to join your organization ({user?.organizationName}).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="team-email">Email</Label>
                  <Input
                    id="team-email"
                    type="email"
                    placeholder="user@example.com"
                    value={teamEmail}
                    onChange={(e) => setTeamEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="team-role">Role</Label>
                  <select
                    id="team-role"
                    value={teamRole}
                    onChange={(e) => setTeamRole(e.target.value as 'MANAGER' | 'VIEWER')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="MANAGER">Manager</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                </div>
                <Button
                  onClick={() => handleInvite('team')}
                  disabled={!teamEmail || submitting}
                  className="w-full"
                >
                  {submitting ? 'Sending...' : 'Send Invite'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invite Result */}
      {inviteResult && (
        <div className="rounded-md border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-4">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            Invite sent to {inviteResult.email}!
          </p>
        </div>
      )}

      {/* Invite Error */}
      {inviteError && (
        <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {inviteError}
        </div>
      )}

      {/* Pending Invites */}
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
                    <td className="px-4 py-2">{inv.role}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-right">
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

      {/* Team Members */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Team Members</h2>
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
                        {member.role}
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
    </div>
  );
}
