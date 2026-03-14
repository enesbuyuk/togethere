import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/auth/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/room/:path*",
    "/api/rooms/:path*", // Protect room APIs
    "/api/search/:path*", // Protect search API
    "/api/active-rooms", // Protect active rooms list
    "/api/user/:path*",   // Protect user profile APIs
  ],
};
