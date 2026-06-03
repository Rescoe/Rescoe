'use client';
import React from 'react';  // ← FIX PARSING + useMemo

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { DeployStep } from '../types';

interface DeployStepsProps {
  steps: DeployStep[];
  setSteps: (steps: DeployStep[]) => void;
  addresses: Record<string, string>;
  onToggleStep: (id: string, enabled: boolean) => void;
  onDeployStep: (step: DeployStep) => Promise<void>;
  onFullDeploy: (orderedSteps: DeployStep[]) => Promise<void>;
  deploying: boolean;
  onClickStep?: (step: DeployStep) => void;
}

function SortableStep({
  step,
  onToggle,
  onDeploy,
  onClick,
}: {
  step: DeployStep;
  onToggle: (id: string, enabled: boolean) => void;
  onDeploy: (step: DeployStep) => void;
  onClick?: (step: DeployStep) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-emerald-400 bg-emerald-900/50 border-emerald-500/30';
      case 'running': return 'text-yellow-400 bg-yellow-900/50 border-yellow-500/30 animate-pulse';
      case 'error': return 'text-red-400 bg-red-900/50 border-red-500/30';
      default: return 'text-zinc-400 bg-zinc-900 border-zinc-800';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer 
                  hover:border-zinc-600 transition-all group
                  ${getStatusColor(step.status || 'pending')}
                  ${isDragging ? 'ring-2 ring-blue-500/50 shadow-2xl z-10' : ''}
                  hover:shadow-xl`}
      onClick={() => onClick?.(step)}
    >
      {/* Drag Handle */}
      <button {...listeners} className="cursor-grab text-zinc-500 hover:text-zinc-300 p-1 -ml-1">
        ☰
      </button>

      {/* Checkbox */}
      <input
        type="checkbox"
        checked={step.enabled}
        onChange={e => onToggle(step.id, e.target.checked)}
        className="w-5 h-5 rounded text-zinc-200 focus:ring-zinc-600"
      />

      {/* Nom contrat */}
      <div className="flex-1 min-w-0">
        <div className="font-mono font-bold text-sm truncate">{step.name}</div>
        {step.content && (
          <div className="text-xs text-zinc-500 truncate mt-0.5">
            {step.content.split('\n')[0]?.slice(0, 50)}…
          </div>
        )}
      </div>

      {/* Status */}
      <div className="text-xs font-mono px-2 py-1 rounded-full bg-black/50 min-w-[70px] text-center">
        {step.status === 'success' && '✓ DEPLOYED'}
        {step.status === 'running' && '⚡ RUNNING'}
        {step.status === 'error' && '✗ ERROR'}
        {step.status === 'pending' && '⏳ PENDING'}
      </div>

      {/* Address */}
      {step.address && (
        <code className="text-xs bg-black/50 px-2 py-1 rounded font-mono truncate max-w-32">
          {step.address.slice(0, 8)}…{step.address.slice(-4)}
        </code>
      )}

      {/* Deploy Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDeploy(step);
        }}
        disabled={!step.enabled || step.status === 'running' || step.status === 'success'}
        className="px-4 py-1.5 bg-blue-600/80 hover:bg-blue-500/90 text-xs font-bold 
                   rounded-lg border border-blue-500/50 disabled:opacity-40 
                   transition-all whitespace-nowrap"
      >
        {step.status === 'running' ? 'WAIT…' : 'DEPLOY'}
      </button>
    </div>
  );
}

export default function DeploySteps({
  steps,
  setSteps,
  onToggleStep,
  onDeployStep,
  onFullDeploy,
  deploying,
  addresses,
  onClickStep,
}: DeployStepsProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = steps.findIndex((step) => step.id === active.id);
      const newIndex = steps.findIndex((step) => step.id === over.id);
      setSteps(arrayMove(steps, oldIndex, newIndex));
    }
  };

  const enabledCount = steps.filter(s => s.enabled).length;

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Stats Header */}
      <div className="text-center py-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
        <div className="text-2xl font-bold text-zinc-200">
          {enabledCount}/{steps.length}
        </div>
        <div className="text-xs text-zinc-500 mt-1">activés / total</div>
      </div>

      {/* Drag & Drop Context */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={steps.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 flex-1 overflow-y-auto">
            {steps.map((step) => (
              <SortableStep
                key={step.id}
                step={step}
                onToggle={onToggleStep}
                onDeploy={onDeployStep}
                onClick={onClickStep}
              />
            ))}
      </div>
    </SortableContext>
  </DndContext>

  {/* STATS + FULL DEPLOY - HYDRATION SAFE */}
  <div className="mt-auto space-y-4">
    <div className="text-center py-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
      <div className="text-2xl font-bold text-zinc-200">
        {enabledCount}/{steps.length}
      </div>
      <div className="text-xs text-zinc-500 mt-1">activés / total</div>
    </div>

    <button
      onClick={() => onFullDeploy(steps.filter((s) => s.enabled))}
      disabled={deploying || enabledCount === 0}
      className={`w-full py-4 rounded-xl font-bold text-lg shadow-xl border-2 transition-all group
                 ${deploying || enabledCount === 0 
                   ? 'opacity-40 cursor-not-allowed bg-gradient-to-r from-zinc-700 to-zinc-800 border-zinc-600' 
                   : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] border-purple-500/50'}`}
      title={deploying ? 'Déploiement en cours…' : `Déployer ${enabledCount} steps`}
    >
      <span className="block group-hover:hidden">
        {deploying ? '🚀 En cours…' : '🚀 FULL DEPLOY'}
      </span>
      <span className="hidden group-hover:block">
        {deploying ? '⏳ Patience…' : `🚀 ${enabledCount} steps`}
      </span>
    </button>
  </div>
</div>

  );
}
