'use client';
import { useState } from 'react';
import type { Exercise } from '@/lib/types';
import { youtubeId, youtubeSearchUrl } from '@/lib/utils';
import Modal from './Modal';
import { IconPlay } from './Icons';

export function ExerciseVideo({ exercise }: { exercise: Exercise }) {
  const id = youtubeId(exercise.video_url);
  return (
    <div className="stack">
      {id ? (
        <div className="polaroid">
          <div className="video">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`}
              title={exercise.name}
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      ) : (
        <div className="postit blue">
          Todavía no hay un video elegido para este ejercicio.
          <div style={{ marginTop: 10 }}>
            <a className="btn sm" href={exercise.video_url || youtubeSearchUrl(exercise.name)} target="_blank" rel="noreferrer">
              <IconPlay /> Ver videos en YouTube
            </a>
          </div>
        </div>
      )}
      {exercise.cues && (
        <div>
          <span className="type">Cómo hacerlo</span>
          <p style={{ margin: '4px 0 0' }}>{exercise.cues}</p>
        </div>
      )}
      <p className="type" style={{ margin: 0 }}>{exercise.muscle_group} · {exercise.equipment}</p>
    </div>
  );
}

export default function VideoButton({ exercise, label = 'Video' }: { exercise: Exercise; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn sm" onClick={() => setOpen(true)} aria-label={`Ver cómo se hace ${exercise.name}`}>
        <IconPlay size={20} /> {label}
      </button>
      {open && (
        <Modal title={exercise.name} onClose={() => setOpen(false)}>
          <ExerciseVideo exercise={exercise} />
        </Modal>
      )}
    </>
  );
}
