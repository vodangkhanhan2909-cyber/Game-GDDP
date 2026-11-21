import { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Multiplier, Question, QuestionOption, QuestionType } from '../game/types.ts';

interface QuestionManagerModalProps {
  isOpen: boolean;
  questions: Question[];
  canEditDeck: boolean;
  onClose: () => void;
  onSetMultiplier: (questionId: string, multiplier: Multiplier) => void;
  onToggleQuestion: (questionId: string, enabled: boolean) => void;
  onUpdateQuestion: (question: Question) => void;
  onAddQuestion: (question: Omit<Question, 'id'>) => void;
  onDeleteQuestion: (questionId: string) => void;
}

const MULTIPLIERS: Multiplier[] = [0, 1, 2, 3];

const DEFAULT_TF_OPTIONS: QuestionOption[] = [
  { key: 'Đúng', label: 'Đúng' },
  { key: 'Sai', label: 'Sai' },
  { key: 'Không được đề cập', label: 'Không được đề cập' },
];

const DEFAULT_MC_OPTIONS: QuestionOption[] = [
  { key: 'A', label: 'Đáp án A' },
  { key: 'B', label: 'Đáp án B' },
  { key: 'C', label: 'Đáp án C' },
  { key: 'D', label: 'Đáp án D' },
];

interface DraftQuestionState {
  id?: string;
  type: QuestionType;
  category: string;
  prompt: string;
  passage: string;
  options: QuestionOption[];
  correctAnswer: string;
  multiplier: Multiplier;
  enabled: boolean;
}

export function QuestionManagerModal({
  isOpen,
  questions,
  canEditDeck,
  onClose,
  onSetMultiplier,
  onToggleQuestion,
  onUpdateQuestion,
  onAddQuestion,
  onDeleteQuestion,
}: QuestionManagerModalProps) {
  const [draft, setDraft] = useState<DraftQuestionState | null>(null);

  if (!isOpen) return null;

  const activeCount = questions.filter((q) => q.enabled).length;

  const openNewDraft = () => {
    setDraft({
      type: 'multiple_choice',
      category: 'Kiến thức chung',
      prompt: '',
      passage: '',
      options: DEFAULT_MC_OPTIONS.map((o) => ({ ...o })),
      correctAnswer: 'A',
      multiplier: 1,
      enabled: true,
    });
  };

  const openEditDraft = (q: Question) => {
    setDraft({
      id: q.id,
      type: q.type,
      category: q.category,
      prompt: q.prompt,
      passage: q.passage ?? '',
      options: q.options.map((o) => ({ ...o })),
      correctAnswer: q.correctAnswer,
      multiplier: q.multiplier,
      enabled: q.enabled,
    });
  };

  const handleDraftTypeChange = (nextType: QuestionType) => {
    if (!draft) return;
    if (nextType === 'true_false_nm') {
      setDraft({
        ...draft,
        type: nextType,
        options: DEFAULT_TF_OPTIONS.map((o) => ({ ...o })),
        correctAnswer: 'Đúng',
      });
    } else {
      setDraft({
        ...draft,
        type: nextType,
        options: DEFAULT_MC_OPTIONS.map((o) => ({ ...o })),
        correctAnswer: 'A',
      });
    }
  };

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || !draft.prompt.trim()) return;

    const payload: Omit<Question, 'id'> = {
      type: draft.type,
      category: draft.category.trim() || 'Chung',
      prompt: draft.prompt.trim(),
      passage: draft.passage.trim() || undefined,
      options: draft.options.map((o) => ({ key: o.key, label: o.label.trim() || o.key })),
      correctAnswer: draft.correctAnswer,
      multiplier: draft.multiplier,
      enabled: draft.enabled,
    };

    if (draft.id) {
      onUpdateQuestion({ ...payload, id: draft.id });
    } else {
      onAddQuestion(payload);
    }
    setDraft(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="question-manager-title"
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-800 bg-[#131C31] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-800">
          <div>
            <h2 id="question-manager-title" className="font-display text-xl font-bold text-slate-50">
              Quản Lý Câu Hỏi &amp; Hệ Số Nhân
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Đang bật {activeCount} / {questions.length} câu hỏi · Tùy chỉnh hệ số điểm (×0, ×1, ×2, ×3)
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canEditDeck && !draft && (
              <button
                type="button"
                onClick={openNewDraft}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 text-xs font-bold transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Thêm câu hỏi
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng trình quản lý câu hỏi"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!canEditDeck && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              Trò chơi đang diễn ra. Bạn vẫn có thể đổi hệ số nhân cho các câu sắp tới, hoặc đặt lại về Phòng chờ để thêm/xóa câu hỏi.
            </div>
          )}

          {draft ? (
            <form onSubmit={handleSaveDraft} className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/80 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-slate-100">
                  {draft.id ? 'Chỉnh sửa câu hỏi' : 'Tạo câu hỏi mới'}
                </h3>
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Hủy
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="q-type" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Loại câu hỏi
                  </label>
                  <select
                    id="q-type"
                    value={draft.type}
                    onChange={(e) => handleDraftTypeChange(e.target.value as QuestionType)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="multiple_choice">Trắc nghiệm (A, B, C, D)</option>
                    <option value="true_false_nm">Đúng / Sai / Không được đề cập</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="q-cat" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Chủ đề
                  </label>
                  <input
                    id="q-cat"
                    type="text"
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    placeholder="VD: Khoa học"
                  />
                </div>

                <div>
                  <span className="block text-xs font-medium text-slate-300 mb-1.5">
                    Hệ số nhân
                  </span>
                  <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-700">
                    {MULTIPLIERS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDraft({ ...draft, multiplier: m })}
                        className={`py-1 rounded text-xs font-mono-tabular font-bold transition-colors ${
                          draft.multiplier === m
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-400 hover:text-slate-100'
                        }`}
                      >
                        ×{m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {draft.type === 'true_false_nm' && (
                <div>
                  <label htmlFor="q-passage" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Đoạn thông tin ngữ cảnh (Không bắt buộc)
                  </label>
                  <textarea
                    id="q-passage"
                    rows={2}
                    value={draft.passage}
                    onChange={(e) => setDraft({ ...draft, passage: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    placeholder="Đoạn trích ngắn cho dạng câu hỏi Đúng / Sai / Không được đề cập..."
                  />
                </div>
              )}

              <div>
                <label htmlFor="q-prompt" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nội dung câu hỏi
                </label>
                <textarea
                  id="q-prompt"
                  required
                  rows={2}
                  value={draft.prompt}
                  onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  placeholder="Nhập nội dung câu hỏi hiển thị trên màn hình..."
                />
              </div>

              {draft.type === 'multiple_choice' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {draft.options.map((opt, idx) => (
                    <div key={opt.key}>
                      <label
                        htmlFor={`q-opt-${opt.key}`}
                        className="block text-xs font-medium text-slate-300 mb-1"
                      >
                        Lựa chọn {opt.key}
                      </label>
                      <input
                        id={`q-opt-${opt.key}`}
                        type="text"
                        required
                        value={opt.label}
                        onChange={(e) => {
                          const next = [...draft.options];
                          next[idx] = { ...opt, label: e.target.value };
                          setDraft({ ...draft, options: next });
                        }}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label htmlFor="q-correct" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Đáp án đúng
                </label>
                <select
                  id="q-correct"
                  value={draft.correctAnswer}
                  onChange={(e) => setDraft({ ...draft, correctAnswer: e.target.value })}
                  className="w-full sm:w-64 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                >
                  {draft.options.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.key === opt.label ? opt.key : `${opt.key}: ${opt.label}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 text-xs font-bold"
                >
                  Lưu câu hỏi
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-2.5">
              {questions.map((q, index) => (
                <div
                  key={q.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    q.enabled
                      ? 'border-slate-800 bg-slate-900/65'
                      : 'border-slate-800/60 bg-slate-950/50 opacity-60'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        type="button"
                        disabled={!canEditDeck}
                        onClick={() => onToggleQuestion(q.id, !q.enabled)}
                        aria-label={`${q.enabled ? 'Tắt' : 'Bật'} câu hỏi ${index + 1}`}
                        className={`mt-0.5 w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                          q.enabled
                            ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                            : 'bg-slate-900 border-slate-700 text-transparent'
                        } disabled:cursor-not-allowed`}
                      >
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-1">
                          <span className="font-mono-tabular font-semibold text-slate-300">
                            Câu {index + 1}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{q.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {q.type === 'multiple_choice'
                              ? 'Trắc nghiệm (A-D)'
                              : 'Đúng / Sai / Không được đề cập'}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-100 leading-snug">
                          {q.prompt}
                        </p>
                        <p className="text-xs text-emerald-400/90 mt-1">
                          Đáp án: {q.correctAnswer}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <div
                        className="inline-flex items-center p-1 rounded-lg bg-slate-950 border border-slate-800"
                        role="group"
                        aria-label={`Hệ số cho câu hỏi ${index + 1}`}
                      >
                        {MULTIPLIERS.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => onSetMultiplier(q.id, m)}
                            className={`px-2.5 py-1 rounded-md text-xs font-mono-tabular font-bold transition-colors ${
                              q.multiplier === m
                                ? m === 0
                                  ? 'bg-slate-700 text-slate-100'
                                  : m === 3
                                    ? 'bg-amber-500 text-slate-950'
                                    : m === 2
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-emerald-600 text-white'
                                : 'text-slate-400 hover:text-slate-100'
                            }`}
                          >
                            ×{m}
                          </button>
                        ))}
                      </div>

                      {canEditDeck && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditDraft(q)}
                            aria-label={`Sửa câu hỏi ${index + 1}`}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                          >
                            <Pencil className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={questions.length <= 1}
                            onClick={() => onDeleteQuestion(q.id)}
                            aria-label={`Xóa câu hỏi ${index + 1}`}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
