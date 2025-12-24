import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Status } from '@prisma/client';
import { isAuthenticated } from '@/lib/telegram-auth';

const prisma = new PrismaClient();

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const message = await prisma.message.findUnique({
      where: { id },
      include: { replies: true },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error('Failed to fetch message:', error);
    return NextResponse.json({ error: 'Failed to fetch message' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    // Validate status
    if (!Object.values(Status).includes(status as Status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updatedMessage = await prisma.message.update({
      where: { id },
      data: { status: status as Status },
    });

    return NextResponse.json(updatedMessage);
  } catch (error) {
    console.error('Failed to update message status:', error);
    return NextResponse.json({ error: 'Failed to update message status' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    await prisma.message.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete message:', error);
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
  }
}
