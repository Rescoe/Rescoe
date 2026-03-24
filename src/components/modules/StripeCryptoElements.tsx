import React from "react";
import { loadStripeOnramp } from "@stripe/crypto";

export const stripeOnrampPromise = loadStripeOnramp(
  process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!
);

const CryptoElementsContext = React.createContext<{ onramp: any }>({ onramp: null });

export const CryptoElements: React.FC<{ stripeOnramp: any; children: React.ReactNode }> = ({
  stripeOnramp,
  children,
}) => {
  const [ctx, setContext] = React.useState({ onramp: null });

  React.useEffect(() => {
    let isMounted = true;
    Promise.resolve(stripeOnramp).then((onramp: any) => {
      if (onramp && isMounted) {
        setContext({ onramp }); // ✅ Force overwrite
      }
    });
    return () => {
      isMounted = false;
    };
  }, [stripeOnramp]);

  return (
    <CryptoElementsContext.Provider value={ctx}>
      {children}
    </CryptoElementsContext.Provider>
  );
};

export const useStripeOnramp = () => React.useContext(CryptoElementsContext).onramp;

export const OnrampElement: React.FC<{
  clientSecret: string;
  appearance?: { theme?: "light" | "dark" };
  onReady?: (event: any) => void;
  onChange?: (event: any) => void;
}> = ({ clientSecret, appearance = { theme: "dark" }, onReady, onChange, ...props }) => {
  const stripeOnramp = useStripeOnramp();
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = ref.current;
    if (!container || !stripeOnramp?.createSession || !clientSecret) {
      return;
    }

    container.innerHTML = "";
    const session = stripeOnramp.createSession({
      clientSecret,
      appearance,
    }).mount(container);

    // ✅ Events corrects
    session?.addEventListener("onramp_ui_loaded", (e: any) => {
      onReady?.(e);
    });

    session?.addEventListener("onramp_session_updated", (e: any) => {
      onChange?.(e);
    });

    return () => {
      session?.destroy?.();
    };
  }, [clientSecret, stripeOnramp, appearance, onReady, onChange]);

  return (
    <div
      {...props}
      ref={ref}
      style={{ height: "600px", width: "100%" }} // ✅ Taille fixe
    />
  );
};
