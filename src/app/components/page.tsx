"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";
import Link from "next/link";

export default function ComponentsPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [progress, setProgress] = useState(50);
  const [sliderValue, setSliderValue] = useState([50]);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8">
        <Link href="/">
          <Button variant="ghost" className="gap-2">
            <span aria-hidden="true">←</span> Back to Home
          </Button>
        </Link>
      </div>

      <div className="mb-12 space-y-2">
        <h1 className="text-4xl font-bold">shadcn/ui Components</h1>
        <p className="text-muted-foreground">
          A comprehensive showcase of all available shadcn/ui components in this
          template.
        </p>
      </div>

      <div className="space-y-16">
        {/* Buttons Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Buttons</h2>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap gap-4">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
              </div>
              <div className="flex flex-wrap gap-4">
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
                <Button size="icon">•</Button>
              </div>
              <ButtonGroup>
                <Button variant="outline">Left</Button>
                <Button variant="outline">Middle</Button>
                <Button variant="outline">Right</Button>
              </ButtonGroup>
            </CardContent>
          </Card>
        </section>

        {/* Badges Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Badges</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge variant="outline">Outline</Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Alerts Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Alerts</h2>
          <div className="space-y-4">
            <Alert>
              <AlertTitle>Default Alert</AlertTitle>
              <AlertDescription>
                This is a default alert message with some description text.
              </AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertTitle>Error Alert</AlertTitle>
              <AlertDescription>
                This is a destructive alert message indicating an error.
              </AlertDescription>
            </Alert>
          </div>
        </section>

        {/* Cards Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Cards</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Card Title</CardTitle>
                <CardDescription>Card description goes here.</CardDescription>
              </CardHeader>
              <CardContent>
                <p>This is the card content area.</p>
              </CardContent>
              <CardFooter>
                <Button>Action</Button>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Another Card</CardTitle>
                <CardDescription>With different content.</CardDescription>
              </CardHeader>
              <CardContent>
                <p>Cards are versatile containers for content.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Forms Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Form Elements</h2>
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <Label htmlFor="input">Input</Label>
                <Input id="input" placeholder="Enter text here..." />
              </div>

              <div className="space-y-2">
                <Label htmlFor="textarea">Textarea</Label>
                <Textarea id="textarea" placeholder="Enter longer text..." />
              </div>

              <div className="space-y-2">
                <Label htmlFor="select">Select</Label>
                <Select>
                  <SelectTrigger id="select">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="option1">Option 1</SelectItem>
                    <SelectItem value="option2">Option 2</SelectItem>
                    <SelectItem value="option3">Option 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="checkbox" />
                <Label htmlFor="checkbox">Accept terms and conditions</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch id="switch" />
                <Label htmlFor="switch">Enable notifications</Label>
              </div>

              <div className="space-y-2">
                <Label>Radio Group</Label>
                <RadioGroup defaultValue="option1">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="option1" id="r1" />
                    <Label htmlFor="r1">Option 1</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="option2" id="r2" />
                    <Label htmlFor="r2">Option 2</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Slider ({sliderValue})</Label>
                <Slider
                  value={sliderValue}
                  onValueChange={setSliderValue}
                  max={100}
                  step={1}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Accordion Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Accordion</h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>Is it accessible?</AccordionTrigger>
              <AccordionContent>
                Yes. It adheres to the WAI-ARIA design pattern.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Is it styled?</AccordionTrigger>
              <AccordionContent>
                Yes. It comes with default styles that matches the other
                components.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Is it animated?</AccordionTrigger>
              <AccordionContent>
                Yes. It&apos;s animated by default, but you can disable it if
                you prefer.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        {/* Tabs Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Tabs</h2>
          <Tabs defaultValue="tab1" className="w-full">
            <TabsList>
              <TabsTrigger value="tab1">Tab 1</TabsTrigger>
              <TabsTrigger value="tab2">Tab 2</TabsTrigger>
              <TabsTrigger value="tab3">Tab 3</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1">
              <Card>
                <CardContent className="pt-6">Content for Tab 1</CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="tab2">
              <Card>
                <CardContent className="pt-6">Content for Tab 2</CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="tab3">
              <Card>
                <CardContent className="pt-6">Content for Tab 3</CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>

        {/* Table Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Table</h2>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>John Doe</TableCell>
                    <TableCell>
                      <Badge>Active</Badge>
                    </TableCell>
                    <TableCell>Admin</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Jane Smith</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Inactive</Badge>
                    </TableCell>
                    <TableCell>User</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Bob Johnson</TableCell>
                    <TableCell>
                      <Badge>Active</Badge>
                    </TableCell>
                    <TableCell>Editor</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* Progress & Loading Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Progress & Loading</h2>
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Progress</Label>
                  <span className="text-muted-foreground text-sm">
                    {progress}%
                  </span>
                </div>
                <Progress value={progress} />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => setProgress(Math.max(0, progress - 10))}
                  >
                    -10%
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setProgress(Math.min(100, progress + 10))}
                  >
                    +10%
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Spinner</Label>
                <div className="flex items-center gap-4">
                  <Spinner className="size-3" />
                  <Spinner className="size-4" />
                  <Spinner className="size-6" />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Skeleton</Label>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Dialogs & Modals Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Dialogs & Modals</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">Open Dialog</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Dialog Title</DialogTitle>
                      <DialogDescription>
                        This is a dialog description. Dialogs are great for
                        forms and important information.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <p>Dialog content goes here.</p>
                    </div>
                  </DialogContent>
                </Dialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline">Open Alert Dialog</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently
                        delete your account and remove your data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Popovers & Tooltips Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Popovers & Tooltips</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">Open Popover</Button>
                  </PopoverTrigger>
                  <PopoverContent>
                    <div className="space-y-2">
                      <h4 className="font-medium">Popover Title</h4>
                      <p className="text-muted-foreground text-sm">
                        Popovers are great for displaying additional
                        information.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline">Hover for Tooltip</Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>This is a tooltip</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <HoverCard>
                  <HoverCardTrigger asChild>
                    <Button variant="outline">Hover Card</Button>
                  </HoverCardTrigger>
                  <HoverCardContent>
                    <div className="space-y-2">
                      <h4 className="font-medium">Hover Card</h4>
                      <p className="text-muted-foreground text-sm">
                        Hover cards show rich content on hover.
                      </p>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Menus Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Menus</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">Dropdown Menu</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>Profile</DropdownMenuItem>
                    <DropdownMenuItem>Settings</DropdownMenuItem>
                    <DropdownMenuItem>Logout</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <Button variant="outline">Right Click Me</Button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem>Copy</ContextMenuItem>
                    <ContextMenuItem>Paste</ContextMenuItem>
                    <ContextMenuItem>Delete</ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Avatar Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Avatars</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <Avatar>
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarFallback>AB</AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarFallback>XY</AvatarFallback>
                </Avatar>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Breadcrumb Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Breadcrumb</h2>
          <Card>
            <CardContent className="pt-6">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/">Home</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/components">
                      Components
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Current Page</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </CardContent>
          </Card>
        </section>

        {/* Calendar Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Calendar</h2>
          <Card>
            <CardContent className="pt-6">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="rounded-md border"
              />
            </CardContent>
          </Card>
        </section>

        {/* Carousel Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Carousel</h2>
          <Card>
            <CardContent className="pt-6">
              <Carousel className="mx-auto w-full max-w-xs">
                <CarouselContent>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <CarouselItem key={index}>
                      <Card>
                        <CardContent className="flex aspect-square items-center justify-center p-6">
                          <span className="text-4xl font-semibold">
                            {index + 1}
                          </span>
                        </CardContent>
                      </Card>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>
            </CardContent>
          </Card>
        </section>

        {/* Collapsible Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Collapsible</h2>
          <Collapsible>
            <Card>
              <CardHeader>
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <CardTitle>Click to expand</CardTitle>
                  <span className="text-sm">▼</span>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <p>
                    This content is hidden by default and can be toggled by
                    clicking the trigger above.
                  </p>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </section>

        {/* Toggle Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Toggle</h2>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex gap-4">
                <Toggle>Single Toggle</Toggle>
                <Toggle variant="outline">Outline Toggle</Toggle>
              </div>
              <ToggleGroup type="single">
                <ToggleGroupItem value="left">Left</ToggleGroupItem>
                <ToggleGroupItem value="center">Center</ToggleGroupItem>
                <ToggleGroupItem value="right">Right</ToggleGroupItem>
              </ToggleGroup>
            </CardContent>
          </Card>
        </section>

        {/* Separator Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Separator</h2>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div>Section 1</div>
              <Separator />
              <div>Section 2</div>
              <Separator />
              <div>Section 3</div>
            </CardContent>
          </Card>
        </section>

        {/* Scroll Area Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Scroll Area</h2>
          <Card>
            <CardContent className="pt-6">
              <ScrollArea className="h-48 w-full rounded-md border p-4">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="py-2">
                    Scroll item {i + 1}
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </section>

        {/* AspectRatio Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Aspect Ratio</h2>
          <Card>
            <CardContent className="pt-6">
              <AspectRatio ratio={16 / 9} className="bg-muted rounded-md">
                <div className="flex h-full items-center justify-center">
                  16:9 Aspect Ratio
                </div>
              </AspectRatio>
            </CardContent>
          </Card>
        </section>

        {/* Kbd Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Keyboard Keys</h2>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm">
                Press <Kbd>Ctrl</Kbd> + <Kbd>C</Kbd> to copy
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
