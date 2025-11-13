import { NextRequest, NextResponse } from 'next/server';
import { messageStore } from '@/lib/messageStore';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// GET - Get all messages or filter by status/category
export async function GET(request: NextRequest) {
  try {
    // Simple auth check
    const authHeader = request.headers.get('authorization');
    const password = authHeader?.replace('Bearer ', '');
    
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const stats = searchParams.get('stats');

    // Return statistics
    if (stats === 'true') {
      return NextResponse.json(messageStore.getStats());
    }

    // Filter by status
    if (status) {
      const messages = messageStore.getMessagesByStatus(status as any);
      return NextResponse.json(messages);
    }

    // Filter by category
    if (category) {
      const messages = messageStore.getMessagesByCategory(category);
      return NextResponse.json(messages);
    }

    // Return all messages
    const messages = messageStore.getAllMessages();
    return NextResponse.json(messages);

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// POST - Update message status or add reply
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const password = authHeader?.replace('Bearer ', '');
    
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, messageId, status, reply } = body;

    if (action === 'updateStatus' && messageId && status) {
      const success = messageStore.updateStatus(messageId, status);
      return NextResponse.json({ success });
    }

    if (action === 'addReply' && messageId && reply) {
      const success = messageStore.addReply(messageId, reply, 'admin');
      return NextResponse.json({ success });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete message
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const password = authHeader?.replace('Bearer ', '');
    
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('id');

    if (!messageId) {
      return NextResponse.json(
        { error: 'Message ID required' },
        { status: 400 }
      );
    }

    const success = messageStore.deleteMessage(messageId);
    return NextResponse.json({ success });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
