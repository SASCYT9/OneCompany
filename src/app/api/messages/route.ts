import { NextRequest, NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { ReplyEmail } from '@/components/emails/ReplyEmail';
import { Resend } from 'resend';
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import React from 'react';
import { PrismaClient, Status } from '@prisma/client';

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

async function handleGet(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.get('stats')) {
    const total = await prisma.message.count();
    const newCount = await prisma.message.count({ where: { status: 'NEW' } });
    const repliedCount = await prisma.message.count({ where: { status: 'REPLIED' } });
    return NextResponse.json({ total, new: newCount, replied: repliedCount });
  }

  const messages = await prisma.message.findMany({
    include: { replies: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(messages);
}

async function handlePost(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { action, messageId } = body;

  switch (action) {
    case 'updateStatus': {
      const { status } = body;
      try {
        await prisma.message.update({
          where: { id: messageId },
          data: { status: status as Status },
        });
        return NextResponse.json({ ok: true });
      } catch (error) {
        console.error('Failed to update status:', error);
        return NextResponse.json({ error: 'Message not found or invalid status' }, { status: 404 });
      }
    }
    case 'addReply': {
      const { replyText, recipientEmail, originalMessage, userName } = body;
      
      const from = process.env.EMAIL_FROM;
      if (!from || !process.env.RESEND_API_KEY) {
        console.error('Email (Resend) environment variables are not set!');
        return NextResponse.json({ error: 'Server misconfigured for sending email' }, { status: 500 });
      }

      try {
        const emailHtml = await render(
          React.createElement(ReplyEmail, {
            userName: userName,
            replyText: replyText,
            originalMessage: originalMessage,
          })
        );

        await resend.emails.send({
          from: `OneCompany <${from}>`,
          to: [recipientEmail],
          subject: `Re: Your inquiry to OneCompany`,
          html: emailHtml,
        });
      } catch (error) {
        console.error('Failed to send reply email:', error);
        return NextResponse.json({ error: 'Failed to send reply email' }, { status: 500 });
      }

      try {
        await prisma.$transaction(async (tx) => {
          await tx.reply.create({
            data: {
              replyText: replyText,
              messageId: messageId,
            },
          });
          await tx.message.update({
            where: { id: messageId },
            data: { status: 'REPLIED' },
          });
        });

        const updatedMessage = await prisma.message.findUnique({
          where: { id: messageId },
          include: { replies: true },
        });
        return NextResponse.json(updatedMessage);
      } catch (error) {
        console.error('Failed to add reply:', error);
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }
    }
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}

async function handleDelete(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing message ID' }, { status: 400 });
  }

  try {
    await prisma.message.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete message:', error);
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }
}

export { handleGet as GET, handlePost as POST, handleDelete as DELETE };

