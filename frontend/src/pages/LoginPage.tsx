import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import axios from 'axios';

import { login } from '@/api/auth';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const auth = await login(data);
      setAuth(auth.token, {
        id: auth.user.id,
        username: auth.user.username,
        email: auth.user.email,
        role: auth.user.role,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        toast.error(err.response.data?.message ?? 'Login failed');
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">XBC Expenses</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>Enter your credentials to access your account</CardDescription>
          </CardHeader>

          <CardContent>
            <form id="login-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>
            </form>
          </CardContent>

          <CardFooter className="flex-col gap-3 bg-transparent border-0">
            <Button
              form="login-form"
              type="submit"
              className="w-full h-9"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-foreground font-medium underline-offset-4 hover:underline">
                Create one
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
