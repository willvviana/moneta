import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Scrolls to the top on every navigation. location.key changes on each navigation, so clicking the
// link of the page you're already on scrolls up too (pathname alone would not).
export function ScrollToTop() {
  const { key } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0); // block body: an effect must not return anything but a cleanup function
  }, [key]);
  return null;
}
