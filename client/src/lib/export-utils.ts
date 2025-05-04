// Import client-side compatible modules
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AttemptResult {
  id: number;
  quizId: number;
  startTime: string;
  endTime: string | null;
  score: number | null;
  tabSwitches: number;
  completed: boolean;
  quiz?: {
    id: number;
    title: string;
    description: string | null;
    passingScore: number;
    timeLimit: number;
  };
}

/**
 * Generates and downloads a CSV file of quiz results
 */
export function downloadResultsAsCsv(attempts: AttemptResult[], username: string) {
  // Format the data for CSV
  const rows = attempts.map(attempt => [
    attempt.quiz?.title || `Quiz ${attempt.quizId}`,
    new Date(attempt.startTime).toLocaleString(),
    attempt.endTime ? new Date(attempt.endTime).toLocaleString() : 'Not completed',
    attempt.score !== null ? `${attempt.score}%` : 'Not scored',
    attempt.completed ? 'Completed' : 'Incomplete',
    attempt.score !== null && attempt.quiz?.passingScore 
      ? (attempt.score >= attempt.quiz.passingScore ? 'Yes' : 'No') 
      : 'N/A',
    attempt.tabSwitches.toString()
  ]);
  
  // Add headers
  const headers = ['Quiz Title', 'Start Time', 'End Time', 'Score', 'Status', 'Passed', 'Tab Switches'];
  rows.unshift(headers);
  
  // Convert to CSV manually instead of using csv-stringify
  const csvContent = rows.map(row => 
    row.map(cell => 
      typeof cell === 'string' && cell.includes(',') 
        ? `"${cell.replace(/"/g, '""')}"` 
        : cell
    ).join(',')
  ).join('\n');
  
  // Create a Blob with the CSV data
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // Create a download link and trigger the download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().split('T')[0];
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${username}_quiz_results_${date}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates and downloads a PDF file of quiz results
 */
export function downloadResultsAsPdf(attempts: AttemptResult[], username: string) {
  // Create a new PDF document
  const doc = new jsPDF();
  const date = new Date().toLocaleDateString();
  
  // Add title and basic information
  doc.setFontSize(18);
  doc.text('Quiz Results Report', 14, 22);
  
  doc.setFontSize(12);
  doc.text(`User: ${username}`, 14, 30);
  doc.text(`Date Generated: ${date}`, 14, 38);
  
  // Format data for the table
  const tableData = attempts.map(attempt => [
    attempt.quiz?.title || `Quiz ${attempt.quizId}`,
    new Date(attempt.startTime).toLocaleString(),
    attempt.endTime ? new Date(attempt.endTime).toLocaleString() : 'Not completed',
    attempt.score !== null ? `${attempt.score}%` : 'Not scored',
    attempt.completed ? 'Completed' : 'Incomplete',
    attempt.score !== null && attempt.quiz?.passingScore 
      ? (attempt.score >= attempt.quiz.passingScore ? 'Yes' : 'No') 
      : 'N/A',
    attempt.tabSwitches.toString()
  ]);
  
  // Add the table to the PDF
  autoTable(doc, {
    head: [['Quiz Title', 'Start Time', 'End Time', 'Score', 'Status', 'Passed', 'Tab Switches']],
    body: tableData,
    startY: 45,
    theme: 'striped',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 10,
      cellPadding: 3
    }
  });
  
  // Add summary statistics
  const totalQuizzes = attempts.length;
  const completedQuizzes = attempts.filter(a => a.completed).length;
  const averageScore = attempts
    .filter(a => a.score !== null)
    .reduce((sum, a) => sum + (a.score || 0), 0) / 
    (attempts.filter(a => a.score !== null).length || 1);
  const passedQuizzes = attempts.filter(a => 
    a.score !== null && 
    a.quiz?.passingScore && 
    a.score >= a.quiz.passingScore
  ).length;
  
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setFontSize(14);
  doc.text('Summary Statistics', 14, finalY);
  
  doc.setFontSize(10);
  doc.text(`Total Quizzes Attempted: ${totalQuizzes}`, 14, finalY + 8);
  doc.text(`Completed Quizzes: ${completedQuizzes}`, 14, finalY + 14);
  doc.text(`Average Score: ${averageScore.toFixed(2)}%`, 14, finalY + 20);
  doc.text(`Passed Quizzes: ${passedQuizzes}`, 14, finalY + 26);
  
  // Add footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(
      `QuizMaster - Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2, 
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  // Download the PDF
  doc.save(`${username}_quiz_results_${date.replace(/\//g, '-')}.pdf`);
}