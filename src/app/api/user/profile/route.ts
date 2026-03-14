import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id;
    const [user] = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
    }).from(users).where(eq(users.id, userId));

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Fetch profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id;
    const { name, email, currentPassword, newPassword } = await req.json();

    if (!userId) {
        return NextResponse.json({ error: "User ID missing from session" }, { status: 401 });
    }

    console.log(`[Profile Update] Updating for user: ${userId}`);

    // Basic validation
    if (name && (name.length < 2 || name.length > 50)) {
        return NextResponse.json({ error: "Name must be between 2 and 50 characters" }, { status: 400 });
    }

    if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
        }
    }

    // Get current user from DB
    const [dbUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updates: any = {};
    if (name) updates.name = name;
    
    if (email && email !== dbUser.email) {
        // Check if email already in use
        const [existingUser] = await db.select().from(users).where(eq(users.email, email));
        if (existingUser) {
            return NextResponse.json({ error: "Email already in use" }, { status: 400 });
        }
        updates.email = email;
    }

    // Password change logic
    if (newPassword) {
        if (!currentPassword) {
            return NextResponse.json({ error: "Current password is required to change password" }, { status: 400 });
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, dbUser.password);
        if (!isPasswordValid) {
            return NextResponse.json({ error: "Incorrect current password" }, { status: 400 });
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
        }

        updates.password = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ message: "No changes to update" });
    }

    await db.update(users).set(updates).where(eq(users.id, userId));

    return NextResponse.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
