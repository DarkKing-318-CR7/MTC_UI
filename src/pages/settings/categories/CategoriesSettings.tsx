import { useCallback, useEffect, useMemo, useState } from "react";
import type { Key } from "react";
import type { ColumnsType } from "antd/es/table";
import { Alert, message, Spin } from "antd";
import { Info, Plus, SquarePen, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import AppTable from "../../../components/common/AppTable";
import AppSearch from "../../../components/common/AppSearch";
import AppTableActions from "../../../components/common/AppTableActions";
import AppConfirmModal from "../../../components/common/AppConfirmModal";
import { useActionPanel } from "../../../contexts/ActionPanelContext";
import type { AppActionPanelItem } from "../../../components/common/AppActionPanel";
import mediaCategoryApi, { type MediaCategoryApiItem } from "../../../api/mediaCategoryApi";
import CategoryModal from "./CategoryModal";
import type { CategoryModalMode } from "./CategoryModal";
import type { Category, CategoryFormValues } from "../types/categories.types";
import "./CategoriesSettings.css";

function mapCategory(item: MediaCategoryApiItem): Category {
  return {
    id: item.id,
    name: item.categoryName,
    description: item.description,
    isDefault: item.isDefault,
  };
}

function CategoriesSettings() {
  const { setActions } = useActionPanel();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<CategoryModalMode>("create");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const navigate = useNavigate();

  const refreshCategories = useCallback(async () => {
    setLoadError(null);
    const response = await mediaCategoryApi.getAll();
    setCategories(response.map(mapCategory));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void refreshCategories()
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Unable to load media categories.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [refreshCategories]);

  const filteredCategories = useMemo(() => {
    const search = keyword.trim().toLowerCase();
    if (!search) return categories;
    return categories.filter((item) =>
      [item.name, item.description ?? ""].some((value) => value.toLowerCase().includes(search)),
    );
  }, [categories, keyword]);

  const openCreateModal = useCallback(() => {
    setEditingCategory(null);
    setModalMode("create");
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((category: Category) => {
    setEditingCategory(category);
    setModalMode("edit");
    setModalOpen(true);
  }, []);

  const openView = useCallback((category: Category) => {
    navigate("/settings/categories/" + encodeURIComponent(category.id));
  }, [navigate]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingCategory(null);
  }, []);

  const handleSaveCategory = async (values: CategoryFormValues) => {
    setSaving(true);
    try {
      const payload = { categoryName: values.name, description: values.description || null };
      if (modalMode === "create") await mediaCategoryApi.create(payload);
      else if (editingCategory) await mediaCategoryApi.update(editingCategory.id, payload);
      await refreshCategories();
      closeModal();
      message.success("Backend confirmed the category save.");
    } catch (error) {
      const body = (error as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
      message.error(body?.message || body?.detail || (error instanceof Error ? error.message : "Unable to save category."));
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      message.warning("Select categories to delete.");
      return;
    }
    setDeleteModalOpen(true);
  }, [selectedRowKeys.length]);

  const handleConfirmDelete = async () => {
    setSaving(true);
    const ids = selectedRowKeys.map(String);
    const results = await Promise.allSettled(ids.map((id) => mediaCategoryApi.delete(id)));
    try {
      await refreshCategories();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Delete completed, but category list refresh failed.");
    }
    const failed = results.filter((result) => result.status === "rejected");
    const removed = results.length - failed.length;
    setSelectedRowKeys([]);
    setCurrentPage(1);
    setDeleteModalOpen(false);
    if (failed.length) {
      const first = failed[0] as PromiseRejectedResult;
      const body = (first.reason as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
      message.error(body?.message || body?.detail || ("Backend deleted " + removed + " of " + ids.length + " categories. Some categories may be defaults or still referenced by media."));
    } else {
      message.success("Backend confirmed deletion of " + removed + " category item(s).");
    }
    setSaving(false);
  };

  const actions = useMemo<AppActionPanelItem[]>(
    () => [
      { key: "add-category", icon: <Plus size={24} />, tooltip: "Thêm lĩnh vực", onClick: openCreateModal },
      { key: "delete-category", icon: <Trash2 size={24} />, tooltip: "Xóa lĩnh vực", danger: true, disabled: selectedRowKeys.length === 0, onClick: openDeleteModal },
    ],
    [openCreateModal, openDeleteModal, selectedRowKeys.length],
  );

  useEffect(() => {
    setActions(actions);
    return () => setActions([]);
  }, [actions, setActions]);

  const columns = useMemo<ColumnsType<Category>>(
    () => [
      {
        title: "STT",
        key: "stt",
        width: 80,
        align: "center",
        render: (_value, _record, index) => (currentPage - 1) * pageSize + index + 1,
      },
      { title: "Tên lĩnh vực", dataIndex: "name", key: "name" },
      { title: "Mô tả", dataIndex: "description", key: "description" },
      {
        title: "Cập nhật",
        key: "actions",
        width: 180,
        align: "center",
        render: (_value, record) => (
          <AppTableActions
            actions={[
              ...(!record.isDefault ? [{
                key: "edit",
                icon: <SquarePen size={20} />,
                tooltip: "Cập nhật lĩnh vực",
                onClick: () => openEditModal(record),
              }] : []),
              {
                key: "info",
                icon: <Info size={20} />,
                tooltip: "Xem thông tin lĩnh vực",
                onClick: () => openView(record),
              },
            ]}
          />
        ),
      },
    ],
    [currentPage, pageSize, openEditModal, openView],
  );

  return (
    <div className="categories-settings">
      <h2 className="categories-settings__title">Danh sách lĩnh vực Media</h2>
      {loadError && <Alert type="error" showIcon message={loadError} />}
      <div className="categories-settings__filter">
        <label htmlFor="categories-search">Từ khóa</label>
        <AppSearch
          id="categories-search"
          width={345}
          placeholder="Nhập từ khóa"
          value={keyword}
          onChange={(value) => { setKeyword(value); setCurrentPage(1); }}
        />
      </div>
      <div className="categories-settings__table">
        {loading ? <Spin /> : (
          <AppTable<Category>
            rowKey="id"
            columns={columns}
            dataSource={filteredCategories}
            selectable
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys([...keys]),
              preserveSelectedRowKeys: true,
            }}
            showSelectedCount
            selectedLabel="lĩnh vực"
            pagination={{
              current: currentPage,
              pageSize,
              total: filteredCategories.length,
              onChange: (page, size) => { setCurrentPage(page); setPageSize(size); },
            }}
          />
        )}
      </div>
      <CategoryModal
        open={modalOpen}
        mode={modalMode}
        category={editingCategory}
        categories={categories}
        onSave={handleSaveCategory}
        onCancel={closeModal}
      />
      <AppConfirmModal
        open={deleteModalOpen}
        type="delete"
        title="Xác nhận xóa lĩnh vực"
        description="Backend sẽ từ chối xóa danh mục mặc định hoặc danh mục đang được media sử dụng."
        confirmText={saving ? "Đang xóa…" : "Tiếp tục"}
        cancelText="Hủy"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalOpen(false)}
      />
    </div>
  );
}

export default CategoriesSettings;