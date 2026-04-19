import {
  Outlet,
  createRoute,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";

import { ChatWorkspacePage } from "@/pages/ChatWorkspace";

const RootRouteComponent = () => <Outlet />;

const rootRoute = createRootRoute({
  component: RootRouteComponent,
});

const indexRoute = createRoute({
  component: ChatWorkspacePage,
  getParentRoute: () => rootRoute,
  path: "/",
});

const conversationRoute = createRoute({
  component: ChatWorkspacePage,
  getParentRoute: () => rootRoute,
  path: "/conversations/$conversationId",
});

const routeTree = rootRoute.addChildren([indexRoute, conversationRoute]);

export const router = createRouter({
  defaultPreload: "intent",
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
