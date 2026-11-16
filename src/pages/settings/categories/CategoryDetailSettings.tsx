import { useEffect, useState } from "react";
import { Alert, Spin } from "antd";
import { useParams } from "react-router-dom";

import mediaCategoryApi, { type MediaCategoryApiItem } from "../../../api/mediaCategoryApi";

import "./CategoryDetailSettings.css";

function CategoryDetailSettings() {
  const { id } = useParams<{ id: string }>();
  const [category, setCategory] = useState<MediaCategoryApiItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    if (!id) {
      setError("Category ID is missing.");
      setLoading(false);
      return;
    }
    void mediaCategoryApi.getById(id)
      .then((item) => { if (active) setCategory(item); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load category.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="category-detail__not-found"><Spin /></div>;
  if (error || !category) {
    return <div className="category-detail__not-found"><Alert type="error" showIcon message={error || "Category not found."} /></div>;
  }

  return (
    <div className="category-detail">
      <section className="category-detail__info">
        <h2 className="category-detail__title">Chi tiết lĩnh vực Media</h2>
        <div className="category-detail__field">
          <span className="category-detail__label">Tên lĩnh vực:</span>
          <span className="category-detail__value">{category.categoryName}</span>
        </div>
        <div className="category-detail__field">
          <span className="category-detail__label">Mô tả:</span>
          <span className="category-detail__value">{category.description || "—"}</span>
        </div>
        <div className="category-detail__field">
          <span className="category-detail__label">Mặc định hệ thống:</span>
          <span className="category-detail__value">{category.isDefault ? "Có" : "Không"}</span>
        </div>
        <div className="category-detail__field">
          <span className="category-detail__label">Cập nhật lần cuối:</span>
          <span className="category-detail__value">{category.updatedAt ? new Date(category.updatedAt).toLocaleString() : "—"}</span>
        </div>
      </section>
      <section className="category-detail__users">
        <h2 className="category-detail__title">Phạm vi danh mục</h2>
        <p>{category.organizationId ? "Danh mục thuộc tổ chức hiện tại." : "Danh mục mặc định toàn hệ thống."}</p>
      </section>
    </div>
  );
}

export default CategoryDetailSettings;
