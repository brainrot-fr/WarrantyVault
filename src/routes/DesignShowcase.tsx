import { toast } from 'sonner';
import { useTheme } from '@/app/theme-context';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ReceiptSlip } from '@/components/ReceiptSlip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusStamp } from '@/components/StatusStamp';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { copy } from '@/lib/copy';

function ComponentSamples() {
  return (
    <div className="design-samples">
      <section className="component-sample" aria-labelledby="sample-actions">
        <h3 id="sample-actions">{copy.componentsTitle}</h3>
        <div className="design-samples-row">
          <Button>{copy.buttonLabel}</Button>
          <Button variant="outline">{copy.returnHome}</Button>
          <Badge>{copy.sampleStatus}</Badge>
          <Badge variant="secondary">{copy.tabReceipt}</Badge>
        </div>
        <Button
          variant="outline"
          onClick={() => toast.success(copy.saveToast, { description: copy.toastDescription })}
        >
          {copy.toastButton}
        </Button>
      </section>

      <section className="component-sample" aria-label={copy.inputLabel}>
        <Field>
          <FieldLabel htmlFor="sample-item-name">{copy.inputLabel}</FieldLabel>
          <Input
            id="sample-item-name"
            placeholder={copy.inputPlaceholder}
            aria-label={copy.inputLabel}
            aria-invalid="true"
            aria-describedby={`${copy.fieldHelpId} ${copy.fieldErrorId}`}
          />
          <FieldDescription id={copy.fieldHelpId}>{copy.fieldHelp}</FieldDescription>
          <FieldError id={copy.fieldErrorId}>{copy.fieldError}</FieldError>
        </Field>
        <Label htmlFor="sample-notes">{copy.tabReceipt}</Label>
        <Textarea id="sample-notes" placeholder={copy.fieldHelp} />
        <Select defaultValue="home">
          <SelectTrigger aria-label={copy.selectHouseholdLabel}>
            <SelectValue placeholder={copy.selectHouseholdLabel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="home">{copy.householdOption}</SelectItem>
          </SelectContent>
        </Select>
      </section>

      <section className="component-sample" aria-label={copy.componentsTitle}>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">{copy.tabOverview}</TabsTrigger>
            <TabsTrigger value="receipt">{copy.tabReceipt}</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">{copy.tabOverviewDescription}</TabsContent>
          <TabsContent value="receipt">{copy.tabReceiptDescription}</TabsContent>
        </Tabs>
        <Separator />
        <div className="design-samples-row">
          <Avatar>
            <AvatarFallback>{copy.brandMonogram}</AvatarFallback>
          </Avatar>
          <Skeleton className="h-10 w-32" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">{copy.sampleStatus}</Button>
            </TooltipTrigger>
            <TooltipContent>{copy.tabOverviewDescription}</TooltipContent>
          </Tooltip>
        </div>
      </section>

      <section className="component-sample" aria-label={copy.commandGroup}>
        <Command>
          <CommandInput placeholder={copy.commandPlaceholder} />
          <CommandList>
            <CommandEmpty>{copy.commandEmpty}</CommandEmpty>
            <CommandGroup heading={copy.commandGroup}>
              <CommandItem>{copy.searchOption}</CommandItem>
              <CommandItem>{copy.buttonLabel}</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </section>

      <section className="component-sample" aria-label={copy.componentsTitle}>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">{copy.openCalendar}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" />
          </PopoverContent>
        </Popover>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">{copy.openMenu}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>{copy.buttonLabel}</DropdownMenuItem>
            <DropdownMenuItem>{copy.returnHome}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </section>

      <section className="component-sample" aria-label={copy.componentsTitle}>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">{copy.showDialog}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{copy.dialogTitle}</DialogTitle>
              <DialogDescription>{copy.dialogDescription}</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">{copy.showAlertDialog}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{copy.alertTitle}</AlertDialogTitle>
              <AlertDialogDescription>{copy.alertDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{copy.returnHome}</AlertDialogCancel>
              <AlertDialogAction>{copy.alertAction}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">{copy.showSheet}</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{copy.sheetTitle}</SheetTitle>
            </SheetHeader>
          </SheetContent>
        </Sheet>
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline">{copy.showWarranties}</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{copy.warrantiesTitle}</DrawerTitle>
            </DrawerHeader>
          </DrawerContent>
        </Drawer>
      </section>

      <ReceiptSlip
        name={copy.sampleName}
        brand={copy.sampleBrand}
        amount={copy.sampleAmount}
        status="active"
        statusLabel={copy.sampleStatus}
      />
      <div className="design-stamps" aria-label={copy.componentsTitle}>
        <StatusStamp status="expiring" label={copy.expiringStatus} />
        <StatusStamp status="expired" label={copy.expiredStatus} />
      </div>
    </div>
  );
}

export function DesignShowcase() {
  const { setTheme } = useTheme();

  return (
    <main className="design-page">
      <header className="design-header">
        <div>
          <h1>{copy.designTitle}</h1>
          <p>{copy.designDescription}</p>
        </div>
        <div className="design-theme-actions" aria-label="Theme preview controls">
          <Button variant="outline" onClick={() => setTheme('light')}>{copy.lightTheme}</Button>
          <Button variant="outline" onClick={() => setTheme('dark')}>{copy.darkTheme}</Button>
          <Button variant="outline" onClick={() => setTheme('system')}>{copy.systemTheme}</Button>
        </div>
      </header>
      <div className="design-preview-grid">
        <section className="theme-sample light" aria-label={copy.lightTheme}>
          <h2>{copy.lightTheme}</h2>
          <ComponentSamples />
        </section>
        <section className="theme-sample dark" aria-label={copy.darkTheme}>
          <h2>{copy.darkTheme}</h2>
          <ComponentSamples />
        </section>
      </div>
    </main>
  );
}
