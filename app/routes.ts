import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
    index("routes/auth.tsx"),
    layout("layouts/Navbar.tsx", [
        route("/home","routes/home.tsx")
    ])
] satisfies RouteConfig;
