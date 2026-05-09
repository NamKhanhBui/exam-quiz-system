import React, { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../config";
import * as mammoth from "mammoth";
import * as XLSX from "xlsx";

// --- 1. COMPONENT THỐNG KÊ (Đã fix map Họ tên & Xuất Excel chuẩn) ---
export function ExamStats({ token, examId, onClose }) {
  const [st, setSt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usersInfo, setUsersInfo] = useState({});

  const loadStats = async () => {
    try {
      const resStats = await axios.get(`${API}/results/exam/${examId}`, { headers: { Authorization: "Bearer " + token } });
      setSt(resStats.data);

      try {
        const authUsersRes = await axios.get(`${API}/auth/users`, { headers: { Authorization: "Bearer " + token } });
        const infoMap = {};
        if (authUsersRes.data && Array.isArray(authUsersRes.data)) {
          authUsersRes.data.forEach(u => {
            infoMap[u.id] = { username: u.username, fullName: u.full_name || u.username };
          });
        }
        setUsersInfo(infoMap);
      } catch (err) { console.error("Lỗi tải User:", err); }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadStats(); }, [examId, token]);

  const handleRegrade = async () => {
    if (!window.confirm("Hành động này sẽ tính lại điểm cho toàn bộ bài thi. Tiếp tục?")) return;
    setLoading(true);
    try {
      await axios.post(`${API}/submissions/regrade/${examId}`, {}, { headers: { Authorization: "Bearer " + token } });
      alert("✅ Đã gửi yêu cầu chấm lại hệ thống!");
      setTimeout(() => { loadStats(); setLoading(false); }, 2000);
    } catch { alert("Lỗi chấm lại!"); setLoading(false); }
  };

  const handleExportExcel = () => {
    if (!st?.details?.length) return alert("Không có dữ liệu!");
    const dataToExport = st.details.map((d, index) => {
      const uInfo = usersInfo[d.user_id] || {};
      return {
        "STT": index + 1,
        "Họ và Tên": uInfo.fullName || `Thí sinh ${d.user_id.slice(0, 5)}`,
        "Số Câu Đúng": `${d.correct_count}/${d.total_questions}`,
        "Điểm Số": d.score,
        "Ngày Nộp": new Date(d.created_at).toLocaleString('vi-VN')
      };
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ThongKeDiem");
    XLSX.writeFile(wb, `Thong_Ke_Diem_De_${examId.slice(0,5)}.xlsx`);
  };

  if (!st) return <div style={{ padding: '20px', textAlign: 'center' }}>Đang tải...</div>;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>📊 Thống kê kết quả đề thi</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-primary" style={{ background: '#10b981' }} onClick={handleExportExcel}>📥 Xuất Excel</button>
          <button className="btn-primary" style={{ background: '#f59e0b' }} onClick={handleRegrade} disabled={loading}>{loading ? "⌛..." : "🔄 Chấm lại"}</button>
          <button className="btn-outline" onClick={onClose}>⬅ Quay lại</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
        <div className="stat-card-mini">Tổng thí sinh: <strong>{st.stats.total}</strong></div>
        <div className="stat-card-mini" style={{ borderLeft: '4px solid #10b981' }}>Trung bình: <strong>{st.stats.avg}</strong></div>
        <div className="stat-card-mini" style={{ borderLeft: '4px solid #4f46e5' }}>Cao nhất: <strong>{st.stats.max}</strong></div>
      </div>
      <table className="history-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>THÍ SINH</th>
            <th style={{ textAlign: 'center' }}>ĐÚNG</th>
            <th style={{ textAlign: 'center' }}>ĐIỂM</th>
            <th style={{ textAlign: 'right' }}>NGÀY NỘP</th>
          </tr>
        </thead>
        <tbody>
          {st.details.map(d => {
            const uInfo = usersInfo[d.user_id] || {};
            return (
              <tr key={d.id}>
                <td><strong>{uInfo.fullName}</strong></td>
                <td style={{ textAlign: 'center' }}>{d.correct_count}/{d.total_questions}</td>
                <td style={{ textAlign: 'center' }}><b style={{ color: '#4f46e5' }}>{d.score}đ</b></td>
                <td style={{ textAlign: 'right', color: '#94a3b8', fontSize: '12px' }}>{new Date(d.created_at).toLocaleString('vi-VN')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- 2. CHỈNH SỬA CÂU HỎI (Hỗ trợ ONBLUR TỰ ĐỘNG LƯU) ---
export function ExamQuestionEditor({ token, examId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchFullExam = () => {
    axios.get(`${API}/exams/internal/${examId}/answers`, { headers: { Authorization: "Bearer " + token } })
      .then(r => setData(r.data));
  };

  useEffect(() => { fetchFullExam(); }, [examId]);

  const handleUpdateText = async (url, text) => {
    try { await axios.put(url, { text }, { headers: { Authorization: "Bearer " + token } }); } catch { console.error("Lỗi tự động lưu!"); }
  };

  const updateCorrectAnswer = async (qId, code) => {
    setLoading(true);
    try {
      await axios.patch(`${API}/exams/questions/${qId}/correct-option`, { correctOptionCode: code }, { headers: { Authorization: "Bearer " + token } });
      fetchFullExam();
    } catch { alert("Lỗi!"); } finally { setLoading(false); }
  };

  if (!data) return <div style={{ padding: '20px', textAlign: 'center' }}>Đang tải đề...</div>;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h3>📝 Sửa đề: {data.exam?.title}</h3>
        <button className="btn-outline" onClick={onClose}>Quay lại</button>
      </div>
      <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {data.questions.map((q, i) => (
          <div key={q.id} className="card" style={{ padding: '15px', marginBottom: '15px', borderLeft: '4px solid #4f46e5' }}>
            <textarea className="login-input" defaultValue={q.text} onBlur={(e) => handleUpdateText(`${API}/exams/questions/${q.id}`, e.target.value)} style={{ width: '100%', height: '50px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {q.options.map(opt => (
                <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: opt.is_correct ? '#f0fdf4' : '#f8fafc', padding: '10px', borderRadius: '6px' }}>
                  <input type="radio" name={`q-${q.id}`} checked={opt.is_correct} onChange={() => updateCorrectAnswer(q.id, opt.code)} disabled={loading} />
                  <input className="login-input" style={{ border: 'none', background: 'transparent', margin: 0 }} defaultValue={opt.text} onBlur={(e) => handleUpdateText(`${API}/exams/options/${opt.id}`, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>💡 Hệ thống tự động lưu khi bạn nhập xong và nhấn chuột ra ngoài.</p>
    </div>
  );
}

// --- 3. QUẢN LÝ ĐỀ THI ---
export function ExamManager({ token, me }) {
  const [exams, setExams] = useState([]);
  const [activeView, setActiveView] = useState('list');
  const [selectedId, setSelectedId] = useState(null);

  const loadExams = () => axios.get(`${API}/exams`, { headers: { Authorization: "Bearer " + token } }).then(r => setExams(r.data));
  useEffect(() => { loadExams(); }, [token]);

  const deleteExam = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa đề thi này?")) return;
    try {
      await axios.delete(`${API}/exams/${id}`, { headers: { Authorization: "Bearer " + token } });
      loadExams();
    } catch { alert("Lỗi xóa đề!"); }
  };

  return (
    <div className="card" style={{ padding: '20px' }}>
      {activeView === 'stats' ? <ExamStats token={token} examId={selectedId} onClose={() => setActiveView('list')} /> :
       activeView === 'edit' ? <ExamQuestionEditor token={token} examId={selectedId} onClose={() => setActiveView('list')} /> :
       <>
         <h3 style={{ marginBottom: '20px' }}>Quản lý đề thi của bạn</h3>
         <table className="history-table" style={{ width: '100%' }}>
            <thead><tr><th>TÊN ĐỀ</th><th>MÔN</th><th style={{ textAlign: 'center' }}>HÀNH ĐỘNG</th></tr></thead>
            <tbody>
              {exams.map(ex => (
                <tr key={ex.id}>
                  <td><strong>{ex.title}</strong></td>
                  <td>{ex.subject}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="btn-primary" style={{ background: '#10b981', padding: '5px 10px' }} onClick={() => { setSelectedId(ex.id); setActiveView('stats'); }}>📊</button>
                    <button className="btn-primary" style={{ background: '#3b82f6', padding: '5px 10px', marginLeft: '5px' }} onClick={() => { setSelectedId(ex.id); setActiveView('edit'); }}>✏️</button>
                    <button className="btn-primary" style={{ background: '#ef4444', padding: '5px 10px', marginLeft: '5px' }} onClick={() => deleteExam(ex.id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
         </table>
       </>
      }
    </div>
  );
}

// --- 4. TẠO ĐỀ THI (Hỗ trợ CHỌN NGẪU NHIÊN từ ngân hàng) ---
export function TeacherPanel({ token, me, refresh }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState(60);
  const [subjects, setSubjects] = useState([]);
  const [bankQuestions, setBankQuestions] = useState([]);
  const [selectedQs, setSelectedQs] = useState([]);
  const [randomCount, setRandomCount] = useState(5);

  useEffect(() => {
    axios.get(`${API}/exams/banks/list/subjects`, { headers: { Authorization: "Bearer " + token } }).then(r => setSubjects(r.data));
  }, [token]);

  useEffect(() => {
    if (subject) axios.get(`${API}/exams/banks/subject/${subject}`, { headers: { Authorization: "Bearer " + token } }).then(r => setBankQuestions(r.data));
  }, [subject]);

  const handleSaveExam = async () => {
    if (!title || !subject || !selectedQs.length) return alert("Vui lòng điền đủ thông tin!");
    try {
      const res = await axios.post(`${API}/exams`, { title, subject, duration, created_by: me.id }, { headers: { Authorization: "Bearer " + token } });
      const qs = bankQuestions.filter(q => selectedQs.includes(q.id));
      await axios.post(`${API}/exams/${res.data.id}/questions-batch`, { questions: qs }, { headers: { Authorization: "Bearer " + token } });
      alert("🚀 Tạo đề thi thành công!"); refresh();
    } catch { alert("Lỗi khi lưu đề!"); }
  };

  const pickRandom = () => {
    const shuffled = [...bankQuestions].sort(() => 0.5 - Math.random());
    setSelectedQs(shuffled.slice(0, randomCount).map(q => q.id));
  };

  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3>🚀 Soạn đề thi mới</h3>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <input className="login-input" style={{ flex: 2 }} placeholder="Tên đề thi" value={title} onChange={e => setTitle(e.target.value)} />
        <select className="login-input" style={{ flex: 1 }} value={subject} onChange={e => setSubject(e.target.value)}>
          <option value="">-- Chọn môn --</option>
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className="login-input" type="number" style={{ width: '80px' }} value={duration} onChange={e => setDuration(e.target.value)} />
        <button className="btn-primary" onClick={handleSaveExam}>Lưu đề</button>
      </div>
      {subject && (
        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px' }}>
          <div style={{ marginBottom: '15px' }}>
            🎲 Lấy ngẫu nhiên <input type="number" style={{ width: '60px' }} value={randomCount} onChange={e => setRandomCount(e.target.value)} /> câu 
            <button className="btn-outline" style={{ marginLeft: '10px', padding: '5px 15px' }} onClick={pickRandom}>Thực hiện</button>
          </div>
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {bankQuestions.map(q => (
              <label key={q.id} style={{ display: 'flex', gap: '10px', padding: '8px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                <input type="checkbox" checked={selectedQs.includes(q.id)} onChange={() => setSelectedQs(prev => prev.includes(q.id) ? prev.filter(i => i !== q.id) : [...prev, q.id])} />
                <span>{q.text}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- 5. QUẢN LÝ NGÂN HÀNG (Hỗ trợ REGEX PARSE WORD chuẩn) ---
export function QuestionBankManager({ token }) {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [questions, setQuestions] = useState([]);
  const [qText, setQText] = useState("");
  const [optTexts, setOptTexts] = useState(["", "", "", ""]);
  const [correctIdx, setCorrectIdx] = useState(0);
  const [newSub, setNewSub] = useState("");

  const loadQuestions = (sub) => axios.get(`${API}/exams/banks/subject/${sub}`, { headers: { Authorization: "Bearer " + token } }).then(r => setQuestions(r.data));
  const loadSubjects = () => axios.get(`${API}/exams/banks/list/subjects`, { headers: { Authorization: "Bearer " + token } }).then(r => setSubjects(r.data));

  useEffect(() => { loadSubjects(); }, []);
  useEffect(() => { if (selectedSubject) loadQuestions(selectedSubject); }, [selectedSubject]);

  const parseWordFile = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const lines = result.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsedQs = []; let currentQ = null;

    lines.forEach(line => {
      // Regex nhận diện câu hỏi: Câu 1:, Question 1:, 1.
      if (line.match(/^(Câu\s*\d+:|Question\s*\d+:|^\d+\.)/i)) {
        if (currentQ) parsedQs.push(currentQ);
        currentQ = { text: line.replace(/^(Câu\s*\d+:|Question\s*\d+:|^\d+\.)\s*/i, ''), options: [] };
      } else if (currentQ && line.match(/^[A-D][\.\)]/)) {
        // Nhận diện đáp án đúng bằng dấu * hoặc chữ (Đúng)
        const isCorrect = line.includes('*') || line.toLowerCase().includes('(đúng)');
        currentQ.options.push({ 
            code: line[0], 
            text: line.substring(2).replace('*', '').replace(/\(Đúng\)/i, '').trim(), 
            is_correct: isCorrect 
        });
      }
    });
    if (currentQ) parsedQs.push(currentQ);
    return parsedQs;
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    const sub = newSub || selectedSubject;
    if (!file || !sub) return alert("Vui lòng chọn môn và file Word!");
    const qs = await parseWordFile(file);
    if (!qs.length) return alert("Không tìm thấy câu hỏi hợp lệ!");
    await axios.post(`${API}/exams/banks-batch`, { subject: sub, questions: qs }, { headers: { Authorization: "Bearer " + token } });
    alert("✅ Đã import thành công " + qs.length + " câu hỏi!"); loadQuestions(sub);
  };

  const addQuestion = async () => {
    const sub = newSub || selectedSubject;
    if (!sub || !qText) return alert("Thiếu thông tin!");
    await axios.post(`${API}/exams/banks`, {
      subject: sub, text: qText,
      options: optTexts.map((t, i) => ({ text: t, code: String.fromCharCode(65 + i), is_correct: i === correctIdx }))
    }, { headers: { Authorization: "Bearer " + token } });
    alert("Đã thêm!"); setQText(""); setOptTexts(["", "", "", ""]); loadQuestions(sub);
  };

  return (
    <div style={{ display: 'flex', gap: '20px' }}>
      <div className="card" style={{ flex: 1, padding: '20px' }}>
        <h3>Quản lý ngân hàng câu hỏi</h3>
        <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
          <select className="login-input" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
            <option value="">-- Chọn môn --</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="login-input" placeholder="Hoặc môn mới" onChange={e => setNewSub(e.target.value)} />
        </div>
        <textarea className="login-input" placeholder="Nội dung câu hỏi" value={qText} onChange={e => setQText(e.target.value)} style={{ height: '80px' }} />
        {optTexts.map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
            <input type="radio" checked={correctIdx === i} onChange={() => setCorrectIdx(i)} />
            <input className="login-input" style={{ margin: 0 }} placeholder={`Đáp án ${String.fromCharCode(65+i)}`} value={t} onChange={e => { const n = [...optTexts]; n[i] = e.target.value; setOptTexts(n); }} />
          </div>
        ))}
        <button className="btn-primary" style={{ width: '100%' }} onClick={addQuestion}>Lưu câu hỏi</button>
        <div style={{ marginTop: '20px', border: '2px dashed #3b82f6', padding: '15px', textAlign: 'center', borderRadius: '8px' }}>
          <p style={{ color: '#3b82f6', fontWeight: 'bold' }}>📄 Import từ file Word (.docx)</p>
          <input type="file" accept=".docx" onChange={handleImport} />
        </div>
      </div>
      <div className="card" style={{ flex: 1.5, padding: '20px', maxHeight: '650px', overflowY: 'auto' }}>
        <h3>Danh sách câu hỏi: {selectedSubject}</h3>
        {questions.map((q, idx) => (
          <div key={q.id} style={{ marginBottom: '15px', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <strong>{idx + 1}. {q.text}</strong>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '13px', marginTop: '5px' }}>
                {q.options?.map(o => <span key={o.id} style={{ color: o.is_correct ? '#10b981' : '#64748b' }}>{o.code}. {o.text} {o.is_correct && '✅'}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}