import Link from "next/link";

/**
 * Small Privacy/Terms link strip rendered at the bottom of every auth
 * surface (login, forgot-password, reset-password). The signup form has
 * its own explicit consent checkbox so it doesn't need this footer.
 *
 * Why bother:
 *   - Returning users who land on /login should be able to find the
 *     policies they originally agreed to.
 *   - Users on /forgot-password may not have an account yet; we still
 *     have to make the policies one click away (DPDP Act 2023 + general
 *     consumer-protection good practice).
 */
export function AuthLegalFooter({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-xs text-muted-foreground ${className}`}>
      By continuing you agree to our{" "}
      <Link className="underline hover:text-foreground" href="/terms" target="_blank" rel="noopener noreferrer">Terms</Link>
      {" "}and{" "}
      <Link className="underline hover:text-foreground" href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>.
    </p>
  );
}
