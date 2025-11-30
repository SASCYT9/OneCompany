// Reply to message API
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { notifyUserReply } from '@/lib/bot/notifications';

const prisma = new PrismaClient();

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { content, sendToTelegram } = await request.json();
    
    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }
    
    // Get the message
    const message = await prisma.message.findUnique({
      where: { id },
    });
    
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    
    // Create reply in database
    const reply = await prisma.reply.create({
      data: {
        messageId: id,
        replyText: content.trim(),
        sentVia: sendToTelegram ? 'telegram' : 'email',
      },
    });
    
    // Update message status
    await prisma.message.update({
      where: { id },
      data: { status: 'REPLIED' },
    });
    
    // Send to Telegram if requested
    if (sendToTelegram) {
      const metadata = message.metadata as { telegramId?: string } | null;
      const telegramId = metadata?.telegramId;
      
      if (telegramId) {
        await notifyUserReply(telegramId, content.trim(), message.messageText);
      }
    }
    
    return NextResponse.json({
      success: true,
      reply: {
        id: reply.id,
        content: reply.replyText,
        sentAt: reply.createdAt,
      },
    });
    
  } catch (error) {
    console.error('Reply error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const replies = await prisma.reply.findMany({
      where: { messageId: id },
      orderBy: { createdAt: 'desc' },
    });
    
    // Transform to consistent format
    const formattedReplies = replies.map(r => ({
      id: r.id,
      content: r.replyText,
      sentAt: r.createdAt,
      sentVia: r.sentVia,
    }));
    
    return NextResponse.json({ replies: formattedReplies });
    
  } catch (error) {
    console.error('Get replies error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
