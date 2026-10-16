import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-[#0E1411]">
      <div className="mb-6 text-center">
        <span className="text-[12px] font-bold tracking-wider text-[#FFC857] uppercase block mb-1">
          Deep Roots
        </span>
        <h1 className="text-[24px] font-extrabold text-[#EAF1EC]">
          Create Your Account
        </h1>
        <p className="text-[13px] text-[#9AAAA0] mt-1">
          Save your discoveries and explore knowledge connections
        </p>
      </div>

      <SignUp
        appearance={{
          elements: {
            rootBox: "w-full max-w-sm",
            card: "bg-[#151D18] border border-[#2A372F] shadow-2xl rounded-[20px]",
            headerTitle: "text-[#EAF1EC] font-bold text-[18px]",
            headerSubtitle: "text-[#9AAAA0] text-[13px]",
            socialButtonsBlockButton: "bg-[#1D2822] border border-[#2A372F] text-[#EAF1EC] hover:bg-[#2A372F]",
            formButtonPrimary: "bg-[#FFC857] text-[#0E1411] font-bold hover:bg-[#E5B040]",
            formFieldInput: "bg-[#0E1411] border-[#2A372F] text-[#EAF1EC]",
            formFieldLabel: "text-[#9AAAA0]",
            footerActionLink: "text-[#FFC857] hover:underline font-semibold",
          },
        }}
      />
    </div>
  );
}
