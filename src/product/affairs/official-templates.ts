// 办事指南 content, each step taken from the cited official HKUST page (re-read 2026-10-05).
// On start-up the server publishes the next revision of a template whenever this content differs from the live one.
import type { createAffairsStore } from './store.js';
import type { Template } from './schemas.js';

type Draft = Omit<Template, 'revision' | 'reviewed_at' | 'review_due_at'>;
const t = (zh: string, en: string) => ({ zh, en });
export const REVIEWED_AT = '2026-10-05T00:30:00.000Z';
export const officialTemplates: Draft[] = [
  {
    template_id: 'library-renewal', school_id: 'hkust',
    title: t('图书续借', 'Renew library loans'),
    summary: t('在图书馆账户里网上续借图书、影音资料和期刊合订本。', 'Renew books, media and bound periodicals online from your library account.'),
    conditions: [
      { id: 'no-request', text: t('有人预约的项目不能续借', 'Items someone has requested cannot be renewed'), source_id: 'renewals' },
      { id: 'overdue', text: t('逾期项目也可以续借，但已产生的逾期罚款会计入你的记录', 'Overdue items can be renewed; the accrued fine is added to your record'), source_id: 'renewals' },
    ],
    materials: [],
    steps: [
      { id: 'account', text: t('在图书馆主页登录你的图书馆账户', 'Sign in to your library account from the Library homepage'), source_id: 'renewals' },
      { id: 'renew', text: t('选择要续借的项目并提交续借', 'Select the items and renew them'), source_id: 'renewals' },
      { id: 'check', text: t('核对续借结果和新的到期日；不同读者和资料类型的续借规则见借阅政策', 'Check the result and new due date; limits by user group and material type are in the Borrowing Policy'), source_id: 'policy' },
    ],
    sources: [
      { id: 'renewals', url: 'https://library.hkust.edu.hk/about-us/policies-and-rules/borrowing-policy/requests-renewals-recalls' },
      { id: 'policy', url: 'https://library.hkust.edu.hk/about-us/policies-and-rules/borrowing-policy/' },
    ],
    source_health: 'verified', deadline: { kind: 'per_user' },
    change_reason: 'Rewritten from the Library "Requests / Renewals / Recalls" page.',
  },
  {
    template_id: 'student-card', school_id: 'hkust',
    title: t('补办学生证', 'Replace your HKUST Card'),
    summary: t('学生证遗失：先在学生内联网挂失，再用表格 RR-26a 申请补办，费用 HK$150。', 'Lost card: report it on the Student Intranet, then apply with Form RR-26a (HK$150).'),
    conditions: [
      { id: 'graduated', text: t('已完成学业的学生不获补发', 'Students who have completed their programme are not issued a replacement'), source_id: 'registry' },
    ],
    materials: [
      { id: 'form', text: t('表格 RR-26a（补发 HKUST Card 申请）', 'Form RR-26a (Application for Replacement of HKUST Card)'), source_id: 'registry' },
      { id: 'fee', text: t('补卡费 HK$150，网上用信用卡缴付；提交后不退还', 'HK$150, paid online by credit card; non-refundable once submitted'), source_id: 'registry' },
    ],
    steps: [
      { id: 'report', text: t('在 Student Intranet 的「Manage my HKUST Card」挂失', 'Report the loss via "Manage my HKUST Card" on the Student Intranet'), source_id: 'registry' },
      { id: 'apply', text: t('提交表格 RR-26a 并网上缴费', 'Submit Form RR-26a and pay online'), source_id: 'registry' },
      { id: 'collect', text: t('领取新卡；新卡发出后旧卡失效，找回旧卡须交回教务处注销', 'Collect the new card; the old one is invalidated, and if found must be returned to the Academic Registry'), source_id: 'registry' },
    ],
    sources: [
      { id: 'registry', url: 'https://registry.hkust.edu.hk/resource-library/lossreplacement-hkust-card' },
      { id: 'card', url: 'https://hkustcard.hkust.edu.hk/administrative-matters-for-students' },
    ],
    source_health: 'verified', deadline: { kind: 'none' },
    change_reason: 'Rewritten from the Academic Registry "Loss/Replacement of the HKUST Card" page.',
  },
  {
    template_id: 'add-drop', school_id: 'hkust',
    title: t('加退选课', 'Add / drop courses'),
    summary: t('春季学期本科生 1 月 26–27 日开始选课，加退选期 2 月 1–17 日，截止后不再受理。', 'Spring: UG enrollment starts 26–27 Jan; add/drop runs 1–17 Feb and nothing is accepted afterwards.'),
    conditions: [
      { id: 'deadline', text: t('按大学学术规例，加退选期结束后不受理加退选申请', 'Under the academic regulations, add/drop requests are not accepted after the add/drop period'), source_id: 'enrollment' },
    ],
    materials: [],
    steps: [
      { id: 'search', text: t('在 SIS 用 Class Search 或「Class Schedule & Quota」查课程和班次', 'Look up classes in SIS Class Search or "Class Schedule & Quota"'), source_id: 'enrollment' },
      { id: 'cart', text: t('把班次放进购物车并做验证；需要老师特别批准的先取得批准', 'Add classes to your shopping cart and validate; get instructor approval first where needed'), source_id: 'enrollment' },
      { id: 'enrol', text: t('按你的预约开始时间提交选课；每日 7:30–9:30 系统维护不能提交', 'Enroll from your appointment start time; requests cannot be submitted during 7:30–9:30 daily maintenance'), source_id: 'enrollment' },
      { id: 'waitlist', text: t('经常查看候补状态；不想要的候补请主动取消，不要拖到最后一刻', 'Check your waitlist often, cancel waiting requests you no longer want, and avoid the last minute'), source_id: 'enrollment' },
    ],
    sources: [
      { id: 'enrollment', url: 'https://registry.hkust.edu.hk/resource-library/class-enrollment-ug' },
      { id: 'calendar', url: 'https://registry.hkust.edu.hk/calendar_dates/dates26-27confirmed.pdf' },
    ],
    source_health: 'verified', deadline: { kind: 'fixed', at: '2027-02-17T15:59:00.000Z', source_id: 'calendar' },
    change_reason: 'Rewritten from the Registry class-enrollment guide; dates from the 2026-27 calendar PDF.',
  },
];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Publish the next revision of each official template whose content differs from the live revision. */
export function syncOfficialTemplates(store: ReturnType<typeof createAffairsStore>, now: () => number) {
  for (const draft of officialTemplates) {
    let current: Template | null = null;
    try { current = store.template(draft.template_id) as Template; } catch { current = null; }
    const { revision: _r, reviewed_at: _a, review_due_at: _d, ...live } = (current ?? {}) as Template;
    if (current && same(live, draft)) continue;
    const reviewed = Math.min(Date.parse(REVIEWED_AT), now());
    store.publish({ ...draft, revision: (current?.revision ?? 0) + 1, reviewed_at: new Date(reviewed).toISOString(), review_due_at: new Date(reviewed + 90 * 864e5).toISOString() }, 'official-sources');
  }
}
