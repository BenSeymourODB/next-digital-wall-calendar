"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SettingsSection } from "./settings-section";

interface TaskValues {
  taskSortOrder: string;
  showCompletedTasks: boolean;
}

interface TaskSectionProps {
  values: TaskValues;
  onChange: (values: Partial<TaskValues>) => void;
}

export function TaskSection({ values, onChange }: TaskSectionProps) {
  return (
    <SettingsSection title="Tasks" description="Configure task list defaults">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Default sort order</Label>
          <Select
            value={values.taskSortOrder}
            onValueChange={(value) => onChange({ taskSortOrder: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dueDate">Due Date</SelectItem>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="createdAt">Created Date</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="show-completed-toggle">Show completed tasks</Label>
          <Switch
            id="show-completed-toggle"
            checked={values.showCompletedTasks}
            onCheckedChange={(checked) =>
              onChange({ showCompletedTasks: checked })
            }
          />
        </div>
      </div>
    </SettingsSection>
  );
}
