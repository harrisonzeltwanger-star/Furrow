import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface InviteInfo {
  email: string;
  role: string;
  type: 'admin' | 'team';
  organizationName: string | null;
}

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    if (!token) {
      setPageError('No invite token provided');
      setLoading(false);
      return;
    }

    api.get(`/users/invite/${token}`)
      .then(({ data }) => setInvite(data.invite))
      .catch((err) => {
        setPageError(err.response?.data?.error?.message || 'Invalid invite link');
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);

    try {
      const body: Record<string, string | undefined> = {
        token: token!,
        name,
        password,
        phone: phone || undefined,
      };
      if (invite?.type === 'admin') {
        body.orgName = orgName;
      }

      const res = await api.post('/users/accept-invite', body);
      const { token: authToken, refreshToken, user } = res.data;
      localStorage.setItem('hay_portal_token', authToken);
      localStorage.setItem('hay_portal_refresh_token', refreshToken);
      localStorage.setItem('hay_portal_user', JSON.stringify(user));
      window.location.href = '/';
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setSubmitError(axiosErr.response?.data?.error?.message || 'Failed to accept invite');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Validating invite...</p>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Invalid Invite</CardTitle>
            <CardDescription>{pageError}</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="outline" onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!invite) return null;

  const isAdmin = invite.type === 'admin';

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">F</span>
            </div>
          </div>
          <CardTitle className="text-2xl">
            {isAdmin ? 'Set Up Your Account' : 'Join the Team'}
          </CardTitle>
          <CardDescription>
            {isAdmin
              ? "You've been invited to join Furrow as a new company admin."
              : `You've been invited to join ${invite.organizationName} on Furrow.`}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {submitError && (
              <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">
                {submitError}
              </div>
            )}

            <div className="rounded-md bg-muted px-4 py-3 text-sm">
              <span className="text-muted-foreground">Email: </span>
              <span className="font-medium">{invite.email}</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="555-123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {isAdmin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input
                    id="orgName"
                    placeholder="Your company name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                  />
                </div>

              </>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Creating Account...' : 'Create Account'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <a href="/login" className="text-primary hover:underline">Sign in</a>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
