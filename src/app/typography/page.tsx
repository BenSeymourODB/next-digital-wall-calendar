import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export default function TypographyPage() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8">
        <Link href="/">
          <Button variant="ghost" className="gap-2">
            <span aria-hidden="true">←</span> Back to Home
          </Button>
        </Link>
      </div>

      <div className="mb-12 space-y-4">
        <h1 className="text-4xl font-bold">Typography System</h1>
        <p className="text-muted-foreground">
          A comprehensive showcase of all typography styles available in this
          template.
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="bg-primary/10 text-primary ring-primary/20 inline-flex items-center rounded-md px-3 py-1 text-sm font-medium ring-1 ring-inset">
            PT Sans Pro
          </span>
          <span className="bg-secondary/10 text-secondary ring-secondary/20 inline-flex items-center rounded-md px-3 py-1 text-sm font-medium ring-1 ring-inset">
            PT Serif Pro
          </span>
        </div>
      </div>

      <div className="space-y-16">
        {/* Headings Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Headings</h2>
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  h1 - Serif font, responsive (3xl → 4xl → 5xl)
                </div>
                <h1>The quick brown fox jumps over the lazy dog</h1>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  h2 - Serif font, responsive (2xl → 3xl → 4xl)
                </div>
                <h2>The quick brown fox jumps over the lazy dog</h2>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  h3 - Serif font, responsive (xl → 2xl → 3xl)
                </div>
                <h3>The quick brown fox jumps over the lazy dog</h3>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  h4 - Uppercase, extrabold, tracking-wide
                </div>
                <h4>The quick brown fox jumps over the lazy dog</h4>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  h5 - Serif font, responsive (base → lg → xl)
                </div>
                <h5>The quick brown fox jumps over the lazy dog</h5>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  h6 - Bold, stone-600 color
                </div>
                <h6>The quick brown fox jumps over the lazy dog</h6>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Font Families Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Font Families</h2>
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  font-sans - PT Sans Pro
                </div>
                <p className="font-sans text-2xl">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  font-serif - PT Serif Pro
                </div>
                <p className="font-serif text-2xl">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  font-mono - System monospace
                </div>
                <p className="font-mono text-2xl">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Text Sizes Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Text Sizes</h2>
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  text-xs
                </div>
                <p className="text-xs">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  text-sm
                </div>
                <p className="text-sm">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  text-base
                </div>
                <p className="text-base">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  text-lg
                </div>
                <p className="text-lg">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  text-xl
                </div>
                <p className="text-xl">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  text-2xl
                </div>
                <p className="text-2xl">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  text-3xl
                </div>
                <p className="text-3xl">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  text-4xl
                </div>
                <p className="text-4xl">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  text-5xl
                </div>
                <p className="text-5xl">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Font Weights Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Font Weights</h2>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  font-thin
                </div>
                <p className="text-xl font-thin">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  font-extralight
                </div>
                <p className="text-xl font-extralight">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  font-light
                </div>
                <p className="text-xl font-light">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  font-normal
                </div>
                <p className="text-xl font-normal">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  font-medium
                </div>
                <p className="text-xl font-medium">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  font-semibold
                </div>
                <p className="text-xl font-semibold">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  font-bold
                </div>
                <p className="text-xl font-bold">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  font-extrabold
                </div>
                <p className="text-xl font-extrabold">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  font-black
                </div>
                <p className="text-xl font-black">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Text Colors Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Text Colors</h2>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  text-foreground (default)
                </div>
                <p className="text-foreground text-xl">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  text-muted-foreground
                </div>
                <p className="text-muted-foreground text-xl">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  text-primary
                </div>
                <p className="text-primary text-xl">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  text-secondary
                </div>
                <p className="text-secondary text-xl">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  text-destructive
                </div>
                <p className="text-destructive text-xl">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  text-accent-foreground
                </div>
                <p className="text-accent-foreground text-xl">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Lists Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Lists</h2>
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  Unordered List (ul)
                </div>
                <ul>
                  <li>First item in the list</li>
                  <li>Second item in the list</li>
                  <li>Third item in the list</li>
                  <li>
                    Nested list:
                    <ul>
                      <li>Nested item 1</li>
                      <li>Nested item 2</li>
                    </ul>
                  </li>
                </ul>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  Ordered List (ol)
                </div>
                <ol>
                  <li>First item in the list</li>
                  <li>Second item in the list</li>
                  <li>Third item in the list</li>
                  <li>
                    Nested list:
                    <ol>
                      <li>Nested item 1</li>
                      <li>Nested item 2</li>
                    </ol>
                  </li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Text Styles Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Text Styles</h2>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  italic
                </div>
                <p className="text-xl italic">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  underline
                </div>
                <p className="text-xl underline">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  line-through
                </div>
                <p className="text-xl line-through">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  uppercase
                </div>
                <p className="text-xl uppercase">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  lowercase
                </div>
                <p className="text-xl lowercase">
                  THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  capitalize
                </div>
                <p className="text-xl capitalize">
                  the quick brown fox jumps over the lazy dog
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Text Alignment Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Text Alignment</h2>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  text-left
                </div>
                <p className="text-left">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  text-center
                </div>
                <p className="text-center">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  text-right
                </div>
                <p className="text-right">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  text-justify
                </div>
                <p className="text-justify">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
                  do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                  Ut enim ad minim veniam, quis nostrud exercitation ullamco
                  laboris.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Line Height Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Line Height</h2>
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  leading-none
                </div>
                <div className="bg-muted p-4 leading-none">
                  <p>Line 1: The quick brown fox jumps over the lazy dog</p>
                  <p>Line 2: The quick brown fox jumps over the lazy dog</p>
                  <p>Line 3: The quick brown fox jumps over the lazy dog</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  leading-tight
                </div>
                <div className="bg-muted p-4 leading-tight">
                  <p>Line 1: The quick brown fox jumps over the lazy dog</p>
                  <p>Line 2: The quick brown fox jumps over the lazy dog</p>
                  <p>Line 3: The quick brown fox jumps over the lazy dog</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  leading-normal
                </div>
                <div className="bg-muted p-4 leading-normal">
                  <p>Line 1: The quick brown fox jumps over the lazy dog</p>
                  <p>Line 2: The quick brown fox jumps over the lazy dog</p>
                  <p>Line 3: The quick brown fox jumps over the lazy dog</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  leading-relaxed
                </div>
                <div className="bg-muted p-4 leading-relaxed">
                  <p>Line 1: The quick brown fox jumps over the lazy dog</p>
                  <p>Line 2: The quick brown fox jumps over the lazy dog</p>
                  <p>Line 3: The quick brown fox jumps over the lazy dog</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  leading-loose
                </div>
                <div className="bg-muted p-4 leading-loose">
                  <p>Line 1: The quick brown fox jumps over the lazy dog</p>
                  <p>Line 2: The quick brown fox jumps over the lazy dog</p>
                  <p>Line 3: The quick brown fox jumps over the lazy dog</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Letter Spacing Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Letter Spacing</h2>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  tracking-tighter
                </div>
                <p className="text-xl tracking-tighter">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  tracking-tight
                </div>
                <p className="text-xl tracking-tight">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  tracking-normal
                </div>
                <p className="text-xl tracking-normal">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  tracking-wide
                </div>
                <p className="text-xl tracking-wide">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  tracking-wider
                </div>
                <p className="text-xl tracking-wider">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-muted-foreground font-mono text-sm">
                  tracking-widest
                </div>
                <p className="text-xl tracking-widest">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Prose Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Prose Example</h2>
          <Card>
            <CardHeader>
              <CardTitle>Article Title</CardTitle>
              <CardDescription>
                Example of body text and paragraphs in a typical content layout
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
                enim ad minim veniam, quis nostrud exercitation ullamco laboris
                nisi ut aliquip ex ea commodo consequat.
              </p>
              <p>
                Duis aute irure dolor in reprehenderit in voluptate velit esse
                cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat
                cupidatat non proident, sunt in culpa qui officia deserunt
                mollit anim id est laborum.
              </p>
              <blockquote className="border-primary border-l-4 pl-4 italic">
                &quot;This is a blockquote example showing how quoted text
                appears in the typography system.&quot;
              </blockquote>
              <p>
                Sed ut perspiciatis unde omnis iste natus error sit voluptatem
                accusantium doloremque laudantium, totam rem aperiam, eaque ipsa
                quae ab illo inventore veritatis et quasi architecto beatae
                vitae dicta sunt explicabo.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
