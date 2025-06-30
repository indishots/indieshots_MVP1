import { Switch, Route } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UltimateAuthProvider } from "@/components/auth/UltimateAuthProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AppLayout from "@/components/layout/app-layout";
import AuthLayout from "@/components/layout/auth-layout";
import { ProtectedRoute } from "@/components/auth/protected-route";
import NotFound from "@/pages/not-found";

// Import existing pages
import Home from "@/pages/home";
import CleanAuth from "@/pages/clean-auth";
import CleanLogout from "@/pages/clean-logout";
import Dashboard from "@/pages/dashboard";
import Upload from "@/pages/upload";
import Parse from "@/pages/parse";
import SceneSelection from "@/pages/scene-selection";
import Columns from "@/pages/columns";
import Shots from "@/pages/shots";
import Storyboards from "@/pages/storyboards";
import Review from "@/pages/review";
import Projects from "@/pages/projects";
import Settings from "@/pages/settings";
import Upgrade from "@/pages/upgrade";
import TestPayment from "@/pages/test-payment";
import PayUCheckout from "@/pages/payu-checkout";
import Contact from "@/pages/contact";
import Admin from "@/pages/admin";

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <UltimateAuthProvider>
          <TooltipProvider>
            <Switch>
              {/* Authentication routes with clean layout */}
              <Route path="/auth">
                <AuthLayout>
                  <CleanAuth />
                </AuthLayout>
              </Route>

              <Route path="/login">
                <AuthLayout>
                  <CleanAuth />
                </AuthLayout>
              </Route>

              <Route path="/signup">
                <AuthLayout>
                  <CleanAuth />
                </AuthLayout>
              </Route>

              <Route path="/logout">
                <CleanLogout />
              </Route>

              {/* Home page with standalone layout */}
              <Route path="/">
                <Home />
              </Route>

              {/* Main application routes with app layout */}
              <Route path="/dashboard">
                <ProtectedRoute component={() => (
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                )} />
              </Route>

              <Route path="/upload">
                <ProtectedRoute component={() => (
                  <AppLayout>
                    <Upload />
                  </AppLayout>
                )} />
              </Route>

              <Route path="/select-scenes/:projectId">
                {(params) => (
                  <ProtectedRoute component={() => (
                    <AppLayout>
                      <SceneSelection id={params.projectId} />
                    </AppLayout>
                  )} />
                )}
              </Route>

              <Route path="/scene-selection/:id">
                {(params) => (
                  <ProtectedRoute component={() => (
                    <AppLayout>
                      <SceneSelection id={params.id} />
                    </AppLayout>
                  )} />
                )}
              </Route>

              <Route path="/jobs/:id/scenes">
                {(params) => (
                  <ProtectedRoute component={() => (
                    <AppLayout>
                      <SceneSelection id={params.id} />
                    </AppLayout>
                  )} />
                )}
              </Route>

              <Route path="/parse/:id">
                {(params) => (
                  <ProtectedRoute component={() => (
                    <AppLayout>
                      <Parse id={params.id} />
                    </AppLayout>
                  )} />
                )}
              </Route>

              <Route path="/columns/:id">
                {(params) => (
                  <ProtectedRoute component={() => (
                    <AppLayout>
                      <Columns id={params.id} />
                    </AppLayout>
                  )} />
                )}
              </Route>

              <Route path="/shots/:projectId/:sceneIndex">
                {(params) => (
                  <ProtectedRoute component={() => (
                    <AppLayout>
                      <Shots jobId={params.projectId} sceneIndex={params.sceneIndex} />
                    </AppLayout>
                  )} />
                )}
              </Route>

              <Route path="/storyboards/:projectId/:sceneIndex">
                {(params) => (
                  <ProtectedRoute component={() => (
                    <AppLayout>
                      <Storyboards jobId={params.projectId} sceneIndex={params.sceneIndex} />
                    </AppLayout>
                  )} />
                )}
              </Route>

              <Route path="/review/:projectId">
                {(params) => (
                  <ProtectedRoute component={() => (
                    <AppLayout>
                      <Review id={params.projectId} />
                    </AppLayout>
                  )} />
                )}
              </Route>

              <Route path="/projects">
                <ProtectedRoute component={() => (
                  <AppLayout>
                    <Projects />
                  </AppLayout>
                )} />
              </Route>

              <Route path="/settings">
                <ProtectedRoute component={() => (
                  <AppLayout>
                    <Settings />
                  </AppLayout>
                )} />
              </Route>

              <Route path="/upgrade">
                <ProtectedRoute component={() => (
                  <AppLayout>
                    <Upgrade />
                  </AppLayout>
                )} />
              </Route>

              <Route path="/test-payment">
                <ProtectedRoute component={() => (
                  <AppLayout>
                    <TestPayment />
                  </AppLayout>
                )} />
              </Route>

              <Route path="/contact">
                <ProtectedRoute component={() => (
                  <AppLayout>
                    <Contact />
                  </AppLayout>
                )} />
              </Route>

              <Route path="/admin">
                <ProtectedRoute component={() => (
                  <AppLayout>
                    <Admin />
                  </AppLayout>
                )} />
              </Route>

              {/* 404 route */}
              <Route>
                <AppLayout>
                  <NotFound />
                </AppLayout>
              </Route>
            </Switch>
            <Toaster />
          </TooltipProvider>
        </UltimateAuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;