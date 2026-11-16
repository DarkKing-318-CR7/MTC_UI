import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { facilityApi } from "../api/facilityApi";
import { authApi } from "../api/authApi";
import { authStorage } from "../utils/authStorage";

import type { Facility as ApiFacility } from "../types/facility.types";
import type { Facility } from "../pages/facilities/types/facility.types";

import {
  findFacilityById,
  findFacilityPath,
} from "../pages/facilities/utils/facility.utils";


interface FacilityContextType {
  facilities: Facility[];
  setFacilities: React.Dispatch<React.SetStateAction<Facility[]>>;

  selectedFacilityId: string | null;
  setSelectedFacilityId: React.Dispatch<React.SetStateAction<string | null>>;

  selectedFacility: Facility | null;
  selectedFacilityPath: Facility[];

  loading: boolean;
  error: string | null;

  refreshFacilities: () => Promise<void>;
}

const FacilityContext = createContext<FacilityContextType | undefined>(
  undefined,
);

interface FacilityProviderProps {
  children: ReactNode;
}

// Chuyển danh sách phẳng từ API thành cây cơ sở.
function buildFacilityTree(items: ApiFacility[]): Facility[] {
  const facilityMap = new Map<string, Facility>();

  items.forEach((item) => {
    facilityMap.set(item.id, {
      ...item,
      children: [],
    });
  });

  const roots: Facility[] = [];

  items.forEach((item) => {
    const facility = facilityMap.get(item.id);

    if (!facility) return;

    const parent = item.parentId ? facilityMap.get(item.parentId) : null;

    // Dữ liệu cha hợp lệ sẽ được đưa vào children.
    if (parent && parent.id !== facility.id) {
      parent.children?.push(facility);
    } else {
      roots.push(facility);
    }
  });

  return roots;
}

export function FacilityProvider({ children }: FacilityProviderProps) {
  const [facilities, setFacilities] = useState<Facility[]>([]);

  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(
    null,
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tải lại danh sách cơ sở từ Back-end.
  const refreshFacilities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const user = await authApi.getMe();
      if (!user.organizationId) {
        throw new Error("Tài khoản hiện tại chưa được gán tổ chức.");
      }
      const response = await facilityApi.getByOrganization(user.organizationId);

      if (!response.success) {
        throw new Error(response.message || "Không thể tải danh sách cơ sở");
      }

      if (!Array.isArray(response.data)) {
        throw new Error("Dữ liệu cơ sở không hợp lệ");
      }

      const facilityTree = buildFacilityTree(response.data);

      setFacilities(facilityTree);

      // Giữ cơ sở đang chọn nếu vẫn còn tồn tại.
      setSelectedFacilityId((currentId) => {
        if (currentId && findFacilityById(facilityTree, currentId)) {
          return currentId;
        }

        if (user.facilityId && findFacilityById(facilityTree, user.facilityId)) {
          return user.facilityId;
        }

        return facilityTree[0]?.id ?? null;
      });
    } catch (err) {
      console.error("Lỗi tải danh sách cơ sở:", err);

      const message =
        err instanceof Error ? err.message : "Không thể tải danh sách cơ sở";

      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Tải dữ liệu khi Provider được khởi tạo.
  useEffect(() => {
    void refreshFacilities().catch(() => {
      // Lỗi đã được lưu trong state error.
    });
  }, [refreshFacilities]);

  useEffect(() => {
    const onAuthChanged = () => {
      if (authStorage.isAuthenticated()) {
        void refreshFacilities().catch(() => undefined);
      } else {
        setFacilities([]);
        setSelectedFacilityId(null);
      }
    };
    window.addEventListener("mtc-auth-changed", onAuthChanged);
    return () => window.removeEventListener("mtc-auth-changed", onAuthChanged);
  }, [refreshFacilities]);

  const selectedFacility = useMemo(() => {
    if (!selectedFacilityId) return null;

    return findFacilityById(facilities, selectedFacilityId);
  }, [facilities, selectedFacilityId]);

  const selectedFacilityPath = useMemo(() => {
    if (!selectedFacilityId) return [];

    return findFacilityPath(facilities, selectedFacilityId);
  }, [facilities, selectedFacilityId]);

  return (
    <FacilityContext.Provider
      value={{
        facilities,
        setFacilities,
        selectedFacilityId,
        setSelectedFacilityId,
        selectedFacility,
        selectedFacilityPath,
        loading,
        error,
        refreshFacilities,
      }}>
      {children}
    </FacilityContext.Provider>
  );
}

export function useFacilityContext() {
  const context = useContext(FacilityContext);

  if (!context) {
    throw new Error(
      "useFacilityContext phải được sử dụng trong FacilityProvider",
    );
  }

  return context;
}
