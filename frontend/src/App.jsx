import { Loader2 } from "lucide-react";
import { Genie } from "./components/art";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import { FocusProvider } from "./components/extras";
import Achievements from "./pages/Achievements";
import Papers from "./pages/Papers";
import PrintPack from "./pages/PrintPack";
import { ForgotPassword, ResetPassword } from "./pages/ResetPassword";
import { AuthProvider, ThemeProvider, ToastProvider, useAuth } from "./lib";
import Analytics from "./pages/Analytics";
import { Login, Register } from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Evaluator from "./pages/Evaluator";
import ExamHall from "./pages/ExamHall";
import Faculty from "./pages/Faculty";
import Landing from "./pages/Landing";
import LearningDNA from "./pages/LearningDNA";
import Mistakes from "./pages/Mistakes";
import { NoteDetail, Notes } from "./pages/Notes";
import Planner from "./pages/Planner";
import { QuizPage, QuizSetup } from "./pages/Quiz";
import Settings from "./pages/Settings";
import { SubjectDetail, Subjects } from "./pages/Subjects";
import Tutor from "./pages/Tutor";
import Viva from "./pages/Viva";

function Protected({ children, faculty }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === undefined)
    return <div className="grid min-h-screen place-items-center"><div className="text-center"><Genie mood="think" size={90} className="animate-bob" /><Loader2 className="mx-auto mt-2 h-6 w-6 animate-spin text-brand-500" /></div></div>;
  if (!user) return <Navigate to={loc.pathname === "/" ? "/" : "/login"} replace state={{ from: loc.pathname }} />;
  if (faculty && user.role !== "faculty") return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/print/:kind/:id" element={<Protected><PrintPack /></Protected>} />
              <Route element={<Protected><FocusProvider><AppLayout /></FocusProvider></Protected>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/subjects" element={<Subjects />} />
                <Route path="/subjects/:id" element={<SubjectDetail />} />
                <Route path="/tutor" element={<Tutor />} />
                <Route path="/tutor/:id" element={<Tutor />} />
                <Route path="/notes" element={<Notes />} />
                <Route path="/notes/:id" element={<NoteDetail />} />
                <Route path="/quiz" element={<QuizSetup />} />
                <Route path="/quiz/:id" element={<QuizPage />} />
                <Route path="/exam-hall" element={<ExamHall />} />
                <Route path="/evaluator" element={<Evaluator />} />
                <Route path="/viva" element={<Viva />} />
                <Route path="/viva/:id" element={<Viva />} />
                <Route path="/mistakes" element={<Mistakes />} />
                <Route path="/planner" element={<Planner />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/learning-dna" element={<LearningDNA />} />
                <Route path="/achievements" element={<Achievements />} />
                <Route path="/papers" element={<Papers />} />
                <Route path="/papers/:id" element={<Papers />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/faculty" element={<Protected faculty><Faculty /></Protected>} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
