import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const errorMessages: Record<string, string> = {
  Configuration: "There is a problem with the server configuration. Check if all environment variables are set correctly.",
  AccessDenied: "Access denied. Your organization may not be registered or you don't have permission.",
  Verification: "The verification link has expired or has already been used.",
  OAuthSignin: "Error starting the OAuth sign-in flow. Check Azure AD configuration.",
  OAuthCallback: "Error during OAuth callback. Check the redirect URI in Azure AD.",
  OAuthCreateAccount: "Could not create user account.",
  EmailCreateAccount: "Could not create user account.",
  Callback: "Error in authentication callback.",
  OAuthAccountNotLinked: "This email is already associated with another account.",
  SessionRequired: "Please sign in to access this page.",
  Default: "An authentication error occurred.",
};

export default function AuthError() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (router.query.error) {
      setError(router.query.error as string);
    }
  }, [router.query]);

  const errorMessage = error ? errorMessages[error] || errorMessages.Default : errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Authentication Error</h1>
        
        {error && (
          <p className="text-sm text-gray-500 mb-2">Error code: {error}</p>
        )}
        
        <p className="text-gray-600 mb-6">{errorMessage}</p>
        
        <div className="space-y-3">
          <button
            onClick={() => router.push("/")}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
          
          <button
            onClick={() => router.push("/")}
            className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Go to Home
          </button>
        </div>
        
        <p className="text-xs text-gray-400 mt-6">
          If this problem persists, contact your administrator.
        </p>
      </div>
    </div>
  );
}
