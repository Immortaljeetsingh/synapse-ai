export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAllNotebooks, createNotebook } from '@/lib/db/queries';

export async function GET() {
  try {
    const notebooks = await getAllNotebooks();
    return NextResponse.json({ success: true, notebooks });
  } catch (err: any) {
    console.error('Error fetching notebooks:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = body.title?.trim() || 'Untitled Notebook';
    const description = body.description?.trim() || '';
    const id = `nb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const notebook = await createNotebook({ id, title, description });
    return NextResponse.json({ success: true, notebook });
  } catch (err: any) {
    console.error('Error creating notebook:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
