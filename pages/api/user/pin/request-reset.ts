import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail, getPinResetEmailHtml, getPinResetEmailText } from '@/lib/email';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = session.user.id;
    const userEmail = session.user.email;
    const userName = session.user.name;

    if (!userEmail) {
      return res.status(400).json({ error: 'No email associated with account' });
    }

    // Generate a secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store the token hash in the database
    const { error: updateError } = await supabaseAdmin
      .from('app_users')
      .update({
        pin_reset_token_hash: tokenHash,
        pin_reset_token_expires: expiresAt.toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error storing reset token:', updateError);
      // Check if columns don't exist
      if (updateError.message?.includes('column') || updateError.code === '42703') {
        return res.status(500).json({ 
          error: 'Database not configured. Please run the PIN reset migration.',
          details: updateError.message 
        });
      }
      return res.status(500).json({ error: 'Failed to generate reset token' });
    }

    // Build the reset URL
    const baseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.host}`;
    const resetUrl = `${baseUrl}/reset-pin?token=${resetToken}&userId=${userId}`;

    // Send the email using Resend
    const emailResult = await sendEmail({
      to: userEmail,
      subject: 'Reset Your Approval PIN - The Circle',
      html: getPinResetEmailHtml(resetUrl, userName || undefined),
      text: getPinResetEmailText(resetUrl, userName || undefined),
    });

    if (!emailResult.success) {
      console.warn('Email send failed:', emailResult.error);
      // Still return success since token was created - user can try again or check with IT
      // In development, we'll include the reset URL so testing is possible
      if (process.env.NODE_ENV === 'development') {
        return res.status(200).json({ 
          success: true, 
          message: 'Reset link generated (email service not configured)',
          warning: 'RESEND_API_KEY not configured. Add it to .env.local',
          resetUrl, // Include URL in dev for testing
        });
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Reset link sent to your email',
      // In development, include the URL for testing
      ...(process.env.NODE_ENV === 'development' && { resetUrl }),
    });
  } catch (error: any) {
    console.error('PIN reset request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
