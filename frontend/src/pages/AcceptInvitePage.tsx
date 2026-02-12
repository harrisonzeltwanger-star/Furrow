import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  organizationType: string | null;
}

const teamSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
});

const adminSchema = teamSchema.extend({
  orgName: z.string().min(1, 'Organization name is required'),
  orgType: z.enum(['BUYER', 'GROWER', 'TRUCKING'], { required_error: 'Organization type is required' }),
});

type TeamForm = z.infer<typeof teamSchema>;
type AdminForm = z.infer<typeof adminSchema>;

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [submitError, setSubmitError] = useState('');

  const teamForm = useForm<TeamForm>({ resolver: zodResolver(teamSchema) });
  const adminForm = useForm<AdminForm>({ resolver: zodResolver(adminSchema) });

  useEffect(() => {
    if (!token) {
      setPageError('No invite token provided');
      setLoading(false);
      return;
    }

    api.get(`/users/invite/${token}`)
      .then(({ data }) => {
        setInvite(data.invite);
      })
      .catch((err) => {
        const message = err.response?.data?.error?.message || 'Invalid invite link';
        setPageError(message);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(formData: TeamForm | AdminForm) {
    setSubmitError('');
    try {
      const res = await api.post('/users/accept-invite', { ...formData, token });
      // Auto-login
      const { token: authToken, refreshToken, user } = res.data;
      localStorage.setItem('hay_portal_token', authToken);
      localStorage.setItem('hay_portal_refresh_token', refreshToken);
      localStorage.setItem('hay_portal_user', JSON.stringify(user));
      // Redirect to dashboard — full reload so AuthProvider picks up the new token
      window.location.href = '/';
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setSubmitError(axiosErr.response?.data?.error?.message || 'Failed to accept invite');
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
  const form = isAdmin ? adminForm : teamForm;

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
        <form onSubmit={form.handleSubmit(handleSubmit)}>
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
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="555-123-4567"
                {...form.register('phone')}
              />
            </div>

            {isAdmin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input
                    id="orgName"
                    placeholder="Your company name"
                    {...(form as ReturnType<typeof useForm<AdminForm>>).register('orgName')}
                  />
                  {(form.formState.errors as AdminForm & { orgName?: { message?: string } }).orgName && (
                    <p className="text-sm text-destructive">
                      {(form.formState.errors as AdminForm & { orgName?: { message?: string } }).orgName?.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orgType">Organization Type</Label>
                  <select
                    id="orgType"
                    {...(form as ReturnType<typeof useForm<AdminForm>>).register('orgType')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select type...</option>
                    <option value="BUYER">Buyer (Feedlot)</option>
                    <option value="GROWER">Grower (Hay Producer)</option>
                    <option value="TRUCKING">Trucking Company</option>
                  </select>
                  {(form.formState.errors as AdminForm & { orgType?: { message?: string } }).orgType && (
                    <p className="text-sm text-destructive">
                      {(form.formState.errors as AdminForm & { orgType?: { message?: string } }).orgType?.message}
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creating Account...' : 'Create Account'}
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
