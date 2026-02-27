import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { BottomNavigation } from './components/BottomNavigation';
import { ToastContainer } from './components/ui/Toast';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { HomeScreen } from './screens/HomeScreen';
import { AskScreen } from './screens/AskScreen';
import { QuestionDetailScreen } from './screens/QuestionDetailScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { PodcastScreen } from './screens/PodcastScreen';
import { GraphScreen } from './screens/GraphScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { mockSettingsService } from './services/mock/settings.mock';

function RootLayout() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--surface)' }}>
      <div style={{ paddingBottom: '80px' }}>
        <Outlet />
      </div>
      <BottomNavigation />
      <ToastContainer />
    </div>
  );
}

function HomeRedirect() {
  const settings = mockSettingsService.getSync();
  if (!settings.preferences.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }
  return <Navigate to="/home" replace />;
}

const router = createBrowserRouter([
  {
    path: '/onboarding',
    element: <OnboardingScreen />,
  },
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'home', element: <HomeScreen /> },
      { path: 'ask', element: <AskScreen /> },
      { path: 'ask/:id', element: <QuestionDetailScreen /> },
      { path: 'graph', element: <GraphScreen /> },
      { path: 'calendar', element: <CalendarScreen /> },
      { path: 'review', element: <ReviewScreen /> },
      { path: 'podcast', element: <PodcastScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
