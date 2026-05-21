import React from "react";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

export default function CustomMap({ children, ...props }: any) {
  return (
    <MapView provider={PROVIDER_GOOGLE} style={{ flex: 1 }} {...props}>
      {children}
    </MapView>
  );
}
export { Marker };
