/**
 * Task Assignments API
 * Manages profile assignments for Google Tasks
 *
 * GET - Get profiles assigned to a task
 * PUT - Set/update profiles assigned to a task
 * DELETE - Remove all assignments for a task
 */
import { getSession } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ taskId: string }>;
}

/**
 * GET /api/tasks/[taskId]/assignments
 * Returns all profiles assigned to a task
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;

  const assignments = await prisma.taskAssignment.findMany({
    where: { taskId },
    include: {
      profile: {
        select: {
          id: true,
          name: true,
          color: true,
          avatar: true,
        },
      },
    },
  });

  return NextResponse.json({ assignments });
}

/**
 * PUT /api/tasks/[taskId]/assignments
 * Set/update profiles assigned to a task
 * Body: { profileIds: string[] }
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;

  let body: { profileIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { profileIds } = body;

  if (!Array.isArray(profileIds)) {
    return NextResponse.json(
      { error: "profileIds array is required" },
      { status: 400 }
    );
  }

  // Delete existing assignments for this task
  await prisma.taskAssignment.deleteMany({
    where: { taskId },
  });

  // Create new assignments if any profiles provided
  if (profileIds.length > 0) {
    await prisma.taskAssignment.createMany({
      data: profileIds.map((profileId: string) => ({
        taskId,
        profileId,
      })),
    });
  }

  // Fetch and return updated assignments
  const assignments = await prisma.taskAssignment.findMany({
    where: { taskId },
    include: {
      profile: {
        select: {
          id: true,
          name: true,
          color: true,
          avatar: true,
        },
      },
    },
  });

  return NextResponse.json({ assignments });
}

/**
 * DELETE /api/tasks/[taskId]/assignments
 * Remove all profile assignments from a task
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;

  const result = await prisma.taskAssignment.deleteMany({
    where: { taskId },
  });

  return NextResponse.json({ deleted: result.count });
}
