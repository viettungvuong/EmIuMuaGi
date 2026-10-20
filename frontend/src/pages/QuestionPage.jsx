import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../i18n';
import '../styles/QuestionPage.css';
import '../styles/AddPage.css'; // For common input styles

export default function QuestionPage() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    
    setLoading(true);
    // TODO: Connect to backend API when available
    // For now we will just simulate a network request
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setQuestion('');
      
      // Reset success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    }, 1000);
  };

  return (
    <div className="question-page">
      <div className="question-card">
        <button className="back-btn" onClick={() => navigate(-1)}>{t('common.back')}</button>
        <h1 className="question-title">{t('question.title')}</h1>

        <form onSubmit={handleSubmit} className="question-form">
          <div className="field-group">
            <label className="field-label" htmlFor="question-input">{t('question.label')}</label>
            <textarea 
              id="question-input" 
              className="field-input field-textarea"
              placeholder={t('question.placeholder')}
              value={question} 
              onChange={(e) => setQuestion(e.target.value)} 
              autoFocus 
            />
          </div>

          {success && <p style={{ color: '#10b981', fontSize: '0.9rem' }}>{t('question.sent')}</p>}

          <button type="submit" className="question-submit-btn" disabled={loading || !question.trim()}>
            {loading ? <span className="spinner" /> : t('question.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
