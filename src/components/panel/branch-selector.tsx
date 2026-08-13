'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Branch {
  id: number;
  name: string;
}

interface BranchSelectorProps {
  branches: Branch[];
  activeBranchId: number;
  setActiveBranchAction: (formData: FormData) => Promise<{ error: string } | null>;
}

export function BranchSelector({
  branches,
  activeBranchId,
  setActiveBranchAction,
}: BranchSelectorProps) {
  const router = useRouter();
  const [selected, setSelected] = useState(String(activeBranchId));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeBranch = branches.find((branch) => branch.id === activeBranchId);

  async function handleChange(value: string | null) {
    if (!value) return;

    setSelected(value);
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set('branchId', value);

    try {
      const result = await setActiveBranchAction(formData);

      if (result?.error) {
        setError(result.error);
        setSelected(String(activeBranchId));
      } else {
        router.refresh();
      }
    } catch {
      setError('No se pudo cambiar la sucursal activa.');
      setSelected(String(activeBranchId));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Select
        value={selected}
        onValueChange={handleChange}
        disabled={isLoading || branches.length === 0}
      >
        <SelectTrigger
          className="w-[180px] text-sm"
          aria-label="Sucursal activa"
        >
          <SelectValue placeholder="Sucursal">
          {activeBranch?.name ?? 'Sucursal'}
        </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={String(branch.id)} data-testid="branch-option">
              {branch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
