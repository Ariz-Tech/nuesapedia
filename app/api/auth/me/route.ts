import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findUserById, getSavedResources, updateUser } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = await findUserById(session.userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const savedResources = await getSavedResources(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        level: user.level,
        avatar: user.avatar,
        role: user.role,
        createdAt: user.createdAt,
      },
      savedResources,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load user profile" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, department, level, avatar } = body;

    const updateData: Partial<{ name: string; department: string; level: string; avatar: string }> = {};
    if (typeof name === "string" && name.trim()) updateData.name = name.trim();
    if (typeof department === "string" && department.trim()) updateData.department = department.trim();
    if (typeof level === "string" && level.trim()) updateData.level = level.trim();
    if (typeof avatar === "string" && avatar.trim()) updateData.avatar = avatar.trim();

    const updated = await updateUser(session.userId, updateData);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        department: updated.department,
        level: updated.level,
        avatar: updated.avatar,
        role: updated.role,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
