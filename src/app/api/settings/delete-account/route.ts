import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

/**
 * DELETE /api/settings/delete-account - Deletes user account and all related data
 */
export async function DELETE() {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    await prisma.user.delete({
      where: { id: userId },
    });

    logger.event("AccountDeleted", { userId });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: "/api/settings/delete-account",
      method: "DELETE",
    });
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
