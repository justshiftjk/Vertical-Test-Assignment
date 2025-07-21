import { useState } from "react";
import { Form, Outlet, redirect, useNavigation } from "react-router";

import logoDark from "../assets/image/logo-dark.svg";
import logoLight from "../assets/image/logo-light.svg";
import icoPush from '../assets/image/ico-push.png';

import { commitSession, getSession } from "~/sessions.server";
import type { Route } from "./+types/Navbar";

// Loader function: Checks user session and returns user data
export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = session.get('user');
  if (!user) {
    return redirect("/");
  }
  // Return user data and set session cookie
  return {
    user,
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  };
}


// Navbar component: Renders navigation bar and handles authentication UI
export default function Navbar({ loaderData }: Route.ComponentProps) {
  // Support both { user } and { existing } shapes for loaderData
  const user =
    (loaderData && "user" in loaderData && loaderData.user) ||
    (loaderData && "existing" in loaderData && loaderData.existing) ||
    null;
  const [showAuth, setShowAuth] = useState(false);
  const navigation = useNavigation();

  return (
    <>
      {/* Navigation bar */}
      <nav className="w-full flex items-center justify-between p-4 shadow-sm h-[100px] dark:border-white dark:bg-gray-800">
        <div className="font-bold text-lg">
           <div className="w-[150px] sm:w-[200px] max-w-[100vw] p-4">
            {/* Logo for light and dark mode */}
            <img
              src={logoLight}
              alt="React Router"
              className="block w-full dark:hidden"
            />
            <img
              src={logoDark}
              alt="React Router"
              className="hidden w-full dark:block"
            />
          </div>
        </div>
        <div>
          {user !== null ? (
            // User is logged in: show signout form and email
            <Form method="post" action="/home">
              <div className="flex items-center gap-4">
                <input type="hidden" name="intent" value={"signout"} />
                <span className="hidden sm:flex">{user.email}</span>
                <span className="sm:hidden">{user.email.split("@")[0]}</span>
                <button
                  className="dark:bg-white/20 rounded-full cursor-pointer hover:scale-105 duration-150"
                  type="submit"
                >
                  <img src={icoPush} className=" cursor-pointer rotate-90 w-10 rounded-full border border-black/20 hover:scale-105" />
                </button>
              </div>
            </Form>
          ) : (
            // User is not logged in: show login/signup button and modal
            <>
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded mr-2"
                onClick={() => setShowAuth(true)}
              >
                Login / Sign Up
              </button>
              {showAuth && (
                <div
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm  bg-opacity-50 flex items-end sm:items-center justify-center z-50"
                  onClick={() => setShowAuth(false)}
                >
                  <div
                    className="bg-white p-2 sm:p-6 rounded-t-2xl sm:rounded-2xl shadow-lg relative w-full sm:w-auto"
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Auth modal content goes here */}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </nav>

      {/* Main content area below navbar */}
      <div
        className={
          `${navigation.state === "loading" ? "loading " : ""} relative h-[calc(100vh-100px)] dark:bg-gray-800`
        }
        id="detail"
      >
        <Outlet />
      </div>
    </>
  );
} 