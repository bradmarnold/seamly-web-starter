export type Tutorial = {
  id: string;
  title: string;
  summary: string;
  steps: { id:string; text:string }[];
};

export const TUTORIALS: Tutorial[] = [
  {
    id: 'bodice-sloper',
    title: 'Basic Bodice Sloper',
    summary: 'Draft a simple front bodice from bust, waist, back length, and shoulder measurements.',
    steps: [
      { id: 'grid', text: 'Set a 10 mm grid. Create origin at (0,0). Place a vertical baseline of body length.' },
      { id: 'bustline', text: 'From origin, draw a horizontal bust line at bust height. Mark bust span.' },
      { id: 'waist', text: 'Place waist line. Draft side seam using 1/4 waist + ease. Add dart intake if desired.' },
      { id: 'neck-shoulder', text: 'Draft neck width and shoulder slope. Add armhole curve using tangent control points.' }
    ]
  },
  {
    id: 'jeans-block',
    title: 'Jeans Block',
    summary: 'Block for five-pocket jeans with straight side seam and contoured waistband.',
    steps: [
      { id: 'rise', text: 'Mark rise and inseam lengths. Draft crotch curve from seat and thigh measurements.' },
      { id: 'knee-hem', text: 'Place knee and hem lines. Set leg width. Connect side and inseam.' },
      { id: 'waistband', text: 'Shape waist and add contoured waistband base line.' }
    ]
  },
  {
    id: 'type3-jacket',
    title: 'Type III Jacket Starter',
    summary: 'Front panel layout with yoke reference and pocket line placement.',
    steps: [
      { id: 'frame', text: 'Draft center front and side seam bounds. Add chest and waist balance lines.' },
      { id: 'yoke', text: 'Place yoke break and pocket line offsets from chest.' }
    ]
  },
  {
    id: 'a2-jacket',
    title: 'A-2 Jacket Starter',
    summary: 'Panel framework for the classic flight jacket with rib knit waistband and collar stand.',
    steps: [
      { id: 'frame', text: 'Lay out body rectangle by chest and back length. Mark waist rib attachment line.' },
      { id: 'collar', text: 'Create collar stand reference and front zip allowance.' }
    ]
  }
];

export function getTutorialById(id: string) {
  return TUTORIALS.find(t => t.id === id) || null;
}
