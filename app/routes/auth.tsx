import {
    commitSession,
    getSession,
} from "../sessions.server";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { redirect, useFetcher, useLocation } from "react-router";
import { ArrowRight, Mail, Lock } from 'lucide-react';
import { Form, useNavigation } from 'react-router';
import Swal from 'sweetalert2'


import type { Route } from "./+types/auth";


// Supabase client setup
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);


// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second

/**
 * 
 * @param fn 
 * @param retries retry 
 * @param delay 
 * @returns 
 */
async function retryWithBackoff(fn: () => Promise<any>, retries = MAX_RETRIES, delay = INITIAL_DELAY) {
    try {
        return await fn();
    } catch (error: any) {
        if (retries === 0 || error?.status !== 429) {
            throw error;
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        return retryWithBackoff(fn, retries - 1, delay * 2);
    }
}

export async function loader({
    request,
    params
}: Route.LoaderArgs) {
    const session = await getSession(request.headers.get("Cookie"));
    const error = session.get("error");
    const info = session.get("info");
    const user = session.get('user')
    if (user) {
        return redirect("/home")
    }
    return {
        error,
        info,
        // ...other loader return values as needed
    };
}

export async function action({
    request,
}: Route.ActionArgs) {
    const authSession = await getSession(
        request.headers.get("Cookie")
    );
    const form = await request.formData();
    const type = form.get('intent');
    if (type === "clear-flash") {
        // Remove flash messages from session
        authSession.flash("info", undefined);
        authSession.flash("error", undefined);
        return new Response(null, {
            headers: {
                "Set-Cookie": await commitSession(authSession),
            },
        });
    }
   
    const email = form.get("email")?.toString();
    const password = form.get("password")?.toString();
    if (email && password)
        if (type === 'signup') {
            const { error: signUpError } = await retryWithBackoff(async () => {
                return await supabase.auth.signUp({
                    email,
                    password,
                });
            });

            if (signUpError) {
                authSession.flash("error", "Sign failed: " + signUpError.message);

                return redirect("/", {
                    headers: {
                        "Set-Cookie": await commitSession(authSession),
                    },
                });
            }
            else {
                // Show success message and redirect to login
                authSession.flash("info", "Account created successfully! Please verify Email and log in");
                return redirect("/", {
                    headers: {
                        "Set-Cookie": await commitSession(authSession),
                    },
                });
            }

        } else {
            const { error: signInError } = await retryWithBackoff(async () => {
                return await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
            });

            if (signInError) {
                authSession.flash("error", "Login failed: " + signInError.message);
                return redirect("/", {
                    headers: {
                        "Set-Cookie": await commitSession(authSession),
                    },
                });
            }
            else {

                // Get session to ensure we have valid tokens
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    authSession.flash("error", "Invalid username/password");
                    return redirect("/", {
                        headers: {
                            "Set-Cookie": await commitSession(authSession),
                        },
                    });
                }
                // Login succeeded, send them to the home page.
                authSession.set("access_token", session.access_token);
                authSession.set("refresh_token", session.refresh_token);
                authSession.set('user', session.user)
                return redirect("/home", {
                    headers: {
                        "Set-Cookie": await commitSession(authSession),
                    },
                });
            }
        }
}

export default function Auth({
    loaderData,
}: any) {
    const [type, setType] = useState("login")
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const navigation = useNavigation();
    const location = useLocation();
    const fetcher = useFetcher();

    useEffect(() => {
        if (loaderData?.error) {
            Swal.fire({ icon: "error", text: loaderData.error }).finally(() => {
                fetcher.submit({ intent: "clear-flash" }, { method: "post" });
            });
        } else if (loaderData?.info) {
            Swal.fire({ icon: "success", text: loaderData.info }).finally(() => {
                fetcher.submit({ intent: "clear-flash" }, { method: "post" });
            });;
        }
    }, [location.key, loaderData?.error, loaderData?.info]);


    return (
        <div className="w-full h-screen dark:bg-gray-800 pt-12 flex items-center justify-center px-4">
            <div className="rounded-2xl shadow-2xl -translate-y-10 w-full sm:w-auto">
                <div className="sm:mx-auto sm:w-full sm:max-w-md pt-12  dark:bg-white rounded-t-2xl">
                    <h2 className="text-center text-3xl font-extrabold text-gray-900 pb-2">
                        {type === 'login' ? 'Welcome back' : "Welcome"}
                    </h2>
                    <p className="text-center text-gray-600 max-w-sm mx-auto">
                        {type === 'login'
                            ? 'Sign in to your account to continue'
                            : 'Start chat with AI bot'
                        }
                    </p>
                </div>
                <div className="pt-8 dark:bg-white rounded-b-2xl sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="bg-white py-8 px-4  sm:px-10 rounded-b-2xl">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-md mb-6">
                                {error}
                            </div>
                        )}

                        <Form className="space-y-6" method="post">
                            <input type="hidden" name="intent" value={type === 'login' ? "login" : "signup"} />
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                    Email address
                                </label>
                                <div className="mt-1 relative">
                                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                    <input
                                        id="email"
                                        type="email"
                                        name="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="text-black pl-10 block w-full px-3 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="you@example.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <div className='flex justify-between'>
                                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                        Password
                                    </label>
                                </div>
                                <div className="mt-1 relative">
                                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                    <input
                                        id="password"
                                        type="password"
                                        name="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="text-black pl-10 block w-full px-3 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={navigation.state === "submitting" || navigation.state === "loading"}
                                className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${navigation.state === "submitting" || navigation.state === "loading" ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {navigation.state === "submitting" || navigation.state === "loading"  ? (
                                    "Processing..."
                                ) : (
                                    <>
                                        {type === 'login' ? "login" : "signup"}
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </>
                                )}
                            </button>

                        </Form>

                        <div className="mt-6">
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-300" />
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white text-gray-500">
                                        {type === 'login' ? "Don't have an account?" : 'Already have an account?'}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-6 text-center">
                                <button
                                    onClick={() => setType(type === 'login' ? 'signup' : 'login')}
                                    className="text-sm font-medium text-blue-600 hover:text-blue-500"
                                >
                                    {type === 'login' ? 'Sign up now' : 'Sign in instead'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
