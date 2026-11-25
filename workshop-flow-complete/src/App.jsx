import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

// Add page imports here
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import PartsRequestForm from './pages/PartsRequestForm';
import About from './pages/About';
import Contact from './pages/Contact';
import VehicleInspection from './pages/VehicleInspection';
import SearchHistory from './pages/SearchHistory';
import FollowUpReport from './pages/FollowUpReport';
import SuperAdminDashboard from './pages/SuperAdminDashboard.jsx';
import BusinessOnboarding from './pages/BusinessOnboarding.jsx';
import BusinessSettings from './pages/BusinessSettings.jsx';

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  // Render all authenticated routes
  return (
    <Routes>
      {/* Default authenticated home → main page (Dashboard) */}
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/VehicleInspection" element={<LayoutWrapper currentPageName="VehicleInspection"><VehicleInspection /></LayoutWrapper>} />
      <Route path="/SearchHistory" element={<LayoutWrapper currentPageName="SearchHistory"><SearchHistory /></LayoutWrapper>} />
      <Route path="/FollowUpReport" element={<LayoutWrapper currentPageName="FollowUpReport"><FollowUpReport /></LayoutWrapper>} />
      <Route path="/SuperAdminDashboard" element={<LayoutWrapper currentPageName="SuperAdminDashboard"><SuperAdminDashboard /></LayoutWrapper>} />
      <Route path="/BusinessOnboarding" element={<LayoutWrapper currentPageName="BusinessOnboarding"><BusinessOnboarding /></LayoutWrapper>} />
      <Route path="/BusinessSettings" element={<LayoutWrapper currentPageName="BusinessSettings"><BusinessSettings /></LayoutWrapper>} />
      <Route path="/PartsRequestForm" element={<LayoutWrapper currentPageName="PartsRequestForm"><PartsRequestForm /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Routes>
          {/* Public pages - no auth required */}
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          {/* All other routes go through AuthProvider */}
          <Route path="/*" element={
            <AuthProvider>
              <NavigationTracker />
              <AuthenticatedApp />
            </AuthProvider>
          } />
        </Routes>
        <Toaster />
      </Router>
    </QueryClientProvider>
  )
}

export default App