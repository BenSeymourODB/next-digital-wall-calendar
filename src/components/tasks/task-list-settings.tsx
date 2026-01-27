"use client";

/**
 * TaskListSettings - Settings modal for task list configuration
 *
 * Features:
 * - Select which task lists to display
 * - Assign colors to each list
 * - Configure display options (show completed, sort order)
 */
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";
import {
  DEFAULT_LIST_COLORS,
  type TaskListConfig,
  type TaskListSelection,
  type TaskListsApiResponse,
  type TaskSortOption,
} from "./types";

export interface TaskListSettingsProps {
  /** Whether the modal is open */
  open: boolean;
  /** Current configuration */
  config: TaskListConfig;
  /** Called when settings are saved */
  onSave: (config: TaskListConfig) => void;
  /** Called when modal is closed */
  onClose: () => void;
}

export function TaskListSettings({
  open,
  config,
  onSave,
  onClose,
}: TaskListSettingsProps) {
  const [localConfig, setLocalConfig] = useState<TaskListConfig>(config);
  const [loading, setLoading] = useState(true);

  // Fetch available task lists when modal opens
  useEffect(() => {
    if (!open) return;

    const fetchLists = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/tasks/lists");
        if (response.ok) {
          const data = (await response.json()) as TaskListsApiResponse;

          // Merge new lists with existing config
          const existingListIds = new Set(
            localConfig.lists.map((l) => l.listId)
          );
          const newLists: TaskListSelection[] = data.lists
            .filter((l) => !existingListIds.has(l.id))
            .map((l, index) => ({
              listId: l.id,
              listTitle: l.title,
              color:
                DEFAULT_LIST_COLORS[
                  (localConfig.lists.length + index) %
                    DEFAULT_LIST_COLORS.length
                ],
              enabled: false,
            }));

          if (newLists.length > 0) {
            setLocalConfig((prev) => ({
              ...prev,
              lists: [...prev.lists, ...newLists],
            }));
          }
        }
      } catch {
        // Silently fail - user can retry
      } finally {
        setLoading(false);
      }
    };

    fetchLists();
  }, [open, localConfig.lists]);

  // Reset local config when config prop changes
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleToggleList = (listId: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      lists: prev.lists.map((list) =>
        list.listId === listId ? { ...list, enabled: !list.enabled } : list
      ),
    }));
  };

  const handleColorChange = (listId: string, color: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      lists: prev.lists.map((list) =>
        list.listId === listId ? { ...list, color } : list
      ),
    }));
  };

  const handleShowCompletedChange = (checked: boolean) => {
    setLocalConfig((prev) => ({
      ...prev,
      showCompleted: checked,
    }));
  };

  const handleSortByChange = (value: TaskSortOption) => {
    setLocalConfig((prev) => ({
      ...prev,
      sortBy: value,
    }));
  };

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Task List Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* List Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Lists to Display</Label>
            {loading ? (
              <p className="text-sm text-gray-500">Loading lists...</p>
            ) : localConfig.lists.length === 0 ? (
              <p className="text-sm text-gray-500">No task lists found</p>
            ) : (
              <div className="space-y-2">
                {localConfig.lists.map((list) => (
                  <div
                    key={list.listId}
                    data-list-item
                    className="flex items-center gap-3"
                  >
                    <Checkbox
                      id={`list-${list.listId}`}
                      checked={list.enabled}
                      onCheckedChange={() => handleToggleList(list.listId)}
                    />
                    <input
                      type="color"
                      value={list.color}
                      onChange={(e) =>
                        handleColorChange(list.listId, e.target.value)
                      }
                      className="h-6 w-6 cursor-pointer rounded border border-gray-200"
                      aria-label={`Color for ${list.listTitle}`}
                    />
                    <Label
                      htmlFor={`list-${list.listId}`}
                      className="flex-1 cursor-pointer"
                    >
                      {list.listTitle}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Display Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Display Options</Label>

            <div className="flex items-center gap-2">
              <Checkbox
                id="show-completed"
                checked={localConfig.showCompleted}
                onCheckedChange={(checked) =>
                  handleShowCompletedChange(checked === true)
                }
                aria-label="Show completed tasks"
              />
              <Label htmlFor="show-completed" className="cursor-pointer">
                Show completed tasks
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="sort-by" className="min-w-[60px]">
                Sort by:
              </Label>
              <Select
                value={localConfig.sortBy}
                onValueChange={handleSortByChange}
              >
                <SelectTrigger id="sort-by" className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dueDate">Due Date</SelectItem>
                  <SelectItem value="created">Created Date</SelectItem>
                  <SelectItem value="manual">Manual Order</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
