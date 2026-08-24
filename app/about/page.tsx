import Panel from "@/components/Panel";

const FAQ_ITEMS = [
  {
    question: "How does integration into a real location work?",
    answer:
      "Add 1 to 3 photos of the place you want to appear in (a restaurant, a rooftop, anywhere you have a picture of). Bluminoo Studio analyzes the light, materials, and mood of the location to blend you into it photorealistically, with no need to write a detailed description.",
  },
  {
    question: "Which photo formats are accepted?",
    answer:
      "JPG, PNG, and WebP, up to 10 MB. Images larger than 2 MB are automatically compressed before upload.",
  },
  {
    question: "How long does a generation take?",
    answer:
      "About 15 to 30 seconds for an image, and 90 seconds or more for a video.",
  },
  {
    question: "Are my photos kept?",
    answer:
      "Your successful renders are saved to your Gallery, tied to your account — accessible from any device once signed in. The privacy policy details the subprocessors used to handle your photos.",
  },
  {
    question: "How does the Video tab work?",
    answer:
      "Upload a source image (and optionally a photo of the replacement object), describe the change you want, and Bluminoo Studio generates a short video with the modification applied.",
  },
];

export default function AProposPage() {
  return (
    <div className="animate-fade-up mx-auto max-w-3xl py-8">
      <Panel className="mb-6 p-6 sm:p-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          About
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
          Bluminoo Studio
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-neutral-400">
          Bluminoo Studio turns a photo into an ultra-realistic life scene,
          designed to impress everyone around you: add a luxury item (watch,
          car) or place yourself in a real location of your choice
          (restaurant, rooftop, or anywhere you have a photo of), while
          preserving your face, pose, lighting, and original framing — as an
          image or a video, ready to post to your story.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          Powered by Gemini 3 Pro Image (Google API) for images, and Kling
          O1 (via fal.ai) for video.
        </p>
      </Panel>

      <Panel className="mb-6 p-6 sm:p-8">
        <h3 className="font-display mb-5 text-2xl font-semibold text-white">
          FAQ
        </h3>
        <div className="space-y-5">
          {FAQ_ITEMS.map((item) => (
            <div key={item.question}>
              <p className="text-sm font-semibold text-neutral-100">
                {item.question}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-6 text-center sm:p-8">
        <h3 className="font-display mb-2 text-xl font-semibold text-white">
          Contact
        </h3>
        <p className="text-sm text-neutral-500">
          A question, a problem?{" "}
          <a
            href="mailto:mathisvergne27@gmail.com"
            className="text-primary-soft underline underline-offset-2 hover:text-primary"
          >
            mathisvergne27@gmail.com
          </a>
        </p>
      </Panel>
    </div>
  );
}
