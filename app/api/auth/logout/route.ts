import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { apiSuccess } from "@/lib/api-helpers";

export async function POST() {
  const response = apiSuccess({ message: "Logged out successfully" });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
